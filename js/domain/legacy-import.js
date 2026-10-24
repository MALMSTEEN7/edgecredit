/**
 * domain/legacy-import · Convierte la exportación del sistema anterior (CREDITOS.exe,
 * base Access ca.mdb) en cartulinas de EdgeCredit. Función pura: no toca el DOM ni guarda.
 *
 * Entrada: el JSON que genera tools/migracion/exportar-cobro.ps1
 *   { cobro: {COB_CODIGO, COB_NOMBRE…}, tarjetas: [{ …TARGETA, cliente: {…CLIENTES}, abonos: [{…DESCRIPCION}] }] }
 * Todos los campos llegan como texto (así los guarda Access en ese sistema).
 *
 * Reglas acordadas para la migración:
 *  - PRES viene en miles; TAR_VALOR, TAR_CUOTA, TSALDO y DES_ABONO en pesos.
 *  - La fecha del abono sale de FECHA_ACT (parte antes de «->») o de `captura`.
 *    DES_FECHA NO se usa: es una fecha consecutiva ficticia.
 *  - Todos los abonos entran como efectivo (el sistema anterior no lo registraba).
 *  - Seguro: 10 % general, ya cobrado en el sistema anterior (no entra a la caja de hoy).
 *  - La cédula se toma tal cual, sin los prefijos A/B ni el sufijo -1 que el sistema
 *    agregaba por cada crédito de la misma persona.
 *  - CLAVO deja la cartulina con advertencia de pago y una nota.
 */

import { generalInsuranceAmount } from './insurance.js';
import { personKey } from './person-cards.js';
import { paymentCycleIndex } from './loan-schedule.js';
import { localDate, localDateISO } from '../shared/dates.js';
import { formatMoney } from '../shared/format.js';

const LEGACY_FREQUENCY = { S: 'weekly', Q: 'biweekly', M: 'monthly', D: 'daily' };
const LEGACY_MONTHS = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };
const NOTES_LIMIT = 1000;

const legacyText = value => String(value ?? '').trim();

/** «600000», «600.000», «$ 600.000», «167200,00» → número en pesos (NaN si no es número). */
export function legacyNumber(value) {
  let text = legacyText(value).replace(/[$\s]/g, '');
  if (!text) return NaN;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '');
  else text = text.replace(',', '.');
  return Number(text);
}

/**
 * Fechas del sistema anterior → yyyy-mm-dd (o '' si no se entiende):
 * «28-03-25», «13-oct-26», «13-oct-26->150», «13/10/2026», «2026-10-13».
 */
export function legacyDate(value) {
  const text = legacyText(value).split('->')[0].trim().toLocaleLowerCase('es');
  if (!text) return '';
  let day; let month; let year;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [, year, month, day] = match.map(Number);
  else if ((match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/))) [, day, month, year] = match.map(Number);
  else if ((match = text.match(/^(\d{1,2})[-/. ]([a-zñ]{3})[a-zñ]*\.?[-/. ](\d{2}|\d{4})\b/))) {
    day = Number(match[1]); month = LEGACY_MONTHS[match[2]]; year = Number(match[3]);
  } else return '';
  if (year < 100) year += 2000;
  const date = new Date(year, month - 1, day);
  if (!month || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return localDateISO(date);
}

/** Cédula sin las marcas del sistema anterior: «A1036…», «B1036…», «1036…-1» → «1036…». */
export function legacyIdNumber(value) {
  return legacyText(value).replace(/^[AB](?=\d)/i, '').replace(/-\d+$/, '');
}

const legacyFlag = value => { const text = legacyText(value).toUpperCase(); return Boolean(text) && !['0', 'NO', 'N', 'FALSE', 'FALSO'].includes(text); };

function legacyInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}

/** Abonos de una tarjeta con fecha real. Los que no tienen fecha toman la del abono anterior. */
function legacyPayments(card, warnings) {
  let previousDate = '';
  return (card.abonos || []).map(row => {
    const amount = Math.round(legacyNumber(row.DES_ABONO));
    let date = legacyDate(row.FECHA_ACT) || legacyDate(row.captura ?? row.CAPTURA);
    if (!date) {
      date = previousDate || legacyDate(card.TAR_FECHA);
      warnings.push(`Abono de ${formatMoney(amount || 0)} sin fecha registrada: se tomó ${date || 'la fecha de inicio'}.`);
    }
    previousDate = date;
    return { date, amount };
  }).filter(payment => {
    if (Number.isFinite(payment.amount) && payment.amount > 0) return true;
    if (payment.amount !== 0) warnings.push('Se omitió un abono con valor no válido.');
    return false;
  });
}

/** Convierte una tarjeta (crédito) del sistema anterior. Devuelve { code, clientId, client, warnings } o { code, error }. */
function convertLegacyCard(card, routeId, importedAt, correction = {}) {
  const code = legacyText(card.TAR_CODIGO);
  const person = card.cliente || {};
  const warnings = [];
  const principal = Math.round(legacyNumber(card.PRES) * 1000);
  const total = Math.round(legacyNumber(card.TAR_VALOR));
  const installment = Math.round(legacyNumber(card.TAR_CUOTA));
  const totalDays = Math.round(legacyNumber(card.TIEMPO));
  const balance = Math.round(legacyNumber(card.TSALDO));
  const creditStartDate = legacyDate(card.TAR_FECHA);
  const frequency = LEGACY_FREQUENCY[legacyText(card.FP).toUpperCase()];
  const legacyName = legacyText(person.CLI_NOMBRE);
  const name = legacyText(correction.name) || legacyName;
  const reference = legacyText(correction.reference);
  if (!code) return { code: '(sin código)', error: 'La tarjeta no tiene código.' };
  if (!legacyName) return { code, error: 'No se encontró el cliente de la tarjeta.' };
  if (!(principal > 0) || !(total > 0)) return { code, error: 'Capital o total no válidos.' };
  if (!(installment > 0) || !(totalDays > 0)) return { code, error: 'Cuota o plazo no válidos.' };
  if (!creditStartDate) return { code, error: `Fecha de inicio no válida (${legacyText(card.TAR_FECHA) || 'vacía'}).` };
  if (!frequency) return { code, error: `Frecuencia de pago desconocida (${legacyText(card.FP) || 'vacía'}).` };
  if (!Number.isFinite(balance)) return { code, error: 'Saldo no válido.' };
  if (balance <= 0) return { code, error: 'El crédito ya no tiene saldo: no se importa como activo.' };

  const payments = legacyPayments(card, warnings);
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (total - paidAmount !== balance) warnings.push(`El saldo del sistema (${formatMoney(balance)}) no cuadra con total − abonos (${formatMoney(total - paidAmount)}). Se usa el saldo del sistema.`);
  const idNumber = legacyIdNumber(person.CLI_CODIGO);
  const phone = legacyText(person.CLI_BARRIO);
  const address = [legacyText(person.CLI_CALLE), legacyText(person.CLI_CIUDAD)].filter(Boolean).join(', ');
  if (!idNumber) warnings.push('Sin cédula.');
  if (!phone) warnings.push('Sin teléfono.');
  if (!address) warnings.push('Sin dirección.');
  const interestPercent = Math.round((total / principal - 1) * 1000) / 10;
  if (interestPercent !== 20) warnings.push(`Interés de ${interestPercent} % (lo normal es 20 %).`);
  const clavo = legacyFlag(card.CLAVO);
  const rating = legacyText(card.TOTRO).toUpperCase();

  const installments = Math.max(1, Math.ceil(total / installment));
  const insuranceAmount = generalInsuranceAmount(principal);
  const client = {
    name, initials: legacyInitials(name), route: routeId, balance, principal, installment,
    status: 'Al día', late: false, id: idNumber, address, altAddress: '', addressHistory: [], phone,
    total, term: `${totalDays} días`, breakdown: `${formatMoney(principal)} / ${formatMoney(total - principal)}`,
    paid: 0, installments, progress: 0, routeDay: 1, totalDays, generalInterest: 0,
    interestPercent, insurancePercent: null, insuranceAmount, insuranceCustom: false, insuranceReason: 'Cobrado en el sistema anterior',
    insuranceCollectedAt: creditStartDate, insuranceCollectedTs: localDate(creditStartDate).getTime(),
    addressNotes: '', notes: '', notesUpdatedAt: null, notesUpdatedBy: null, payments: [], interestHistory: [], noBaseImpact: true,
    frequency, creditStartDate, visitHistory: [], paymentWarning: clavo, paidPeriodIndexes: [], schedulePaidBaseline: 0,
    photoData: '', totalPaidAmount: paidAmount, settledAt: null,
    importedFrom: { system: 'CREDITOS', code, personCode: legacyText(person.CLI_CODIGO), importedAt },
  };
  if (clavo) client.worstHistory = 'irregular';
  client.payments = payments
    .map(payment => ({ date: payment.date, amount: payment.amount, method: 'cash', cycleIndex: paymentCycleIndex(client, payment.date), receiptName: '', receiptData: '', imported: true }))
    .sort((a, b) => b.date.localeCompare(a.date));
  client.paidPeriodIndexes = [...new Set(client.payments.map(payment => payment.cycleIndex))].sort((a, b) => a - b);
  // Cuotas cubiertas según lo abonado: así el atraso se mide por plata pagada, aunque
  // en el sistema anterior un abono cubriera varias cuotas o media cuota.
  client.schedulePaidBaseline = Math.min(installments, Math.floor(paidAmount / installment));
  client.paid = client.schedulePaidBaseline;
  client.progress = Math.min(100, Math.round(paidAmount / total * 100));

  const notes = [`Migrado del sistema anterior (crédito ${code}).`];
  if (name !== legacyName) notes.push(`Nombre en el sistema anterior: ${legacyName}.`);
  if (reference) notes.push(`Referencia: ${reference}.`);
  if (rating) notes.push(`Calificación anterior: ${rating}.`);
  if (clavo) notes.push('CLAVO (mora) en el sistema anterior.');
  const history = [legacyText(person.ESTADO2), legacyText(card.DATOS)].filter(Boolean).join(' · ');
  if (history) notes.push(`Historial anterior: ${history}`);
  client.notes = notes.join('\n').slice(0, NOTES_LIMIT);
  client.notesUpdatedAt = importedAt;
  client.notesUpdatedBy = 'Migración';
  return { code, legacyName, reference, clientId: `legacy-${code.toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '-')}`, client, warnings };
}

/**
 * La primera versión del script de exportación dejaba cada lista dentro de otra lista
 * ([[…]]) y, en lo más profundo, PowerShell convertía los abonos en texto («@{DES_ABONO=…}»).
 * Se aceptan las listas anidadas; el texto no, porque ya no se pueden leer los valores.
 */
function legacyRow(value) {
  const rows = (Array.isArray(value) ? value.flat(Infinity) : [value]).filter(item => item != null);
  if (rows.some(item => typeof item === 'string' && item.startsWith('@{'))) {
    throw new Error('El archivo se generó con la versión anterior del script y le faltan datos. Descarga de nuevo exportar-cobro.ps1 y vuelve a exportar.');
  }
  return rows.find(item => typeof item === 'object') || null;
}

function legacyCardRows(card) {
  const abonos = (Array.isArray(card?.abonos) ? card.abonos.flat(Infinity) : [card?.abonos]).filter(item => item != null);
  if (abonos.some(item => typeof item !== 'object')) legacyRow(abonos);
  return { ...card, cliente: legacyRow(card?.cliente), abonos: abonos.filter(item => typeof item === 'object') };
}

/**
 * Archivo de correcciones de nombres (se prepara aparte y NO se guarda en el repositorio):
 *   { "tipo": "edgecredit-correcciones", "cobro": "DONMATIAS",
 *     "creditos": { "DONMATIAS22": { "nombre": "Juan Carlos Gutierrez", "referencia": "Policía" } } }
 * Devuelve { DONMATIAS22: { name, reference } }.
 */
export function legacyCorrections(raw) {
  if (!raw || raw.tipo !== 'edgecredit-correcciones' || typeof raw.creditos !== 'object') {
    throw new Error('No es un archivo de correcciones de EdgeCredit.');
  }
  return Object.fromEntries(Object.entries(raw.creditos).map(([code, item]) => [
    legacyText(code).toUpperCase(), { name: legacyText(item?.nombre), reference: legacyText(item?.referencia) },
  ]));
}

/**
 * Convierte la exportación completa de un cobro.
 * `corrections`: { CODIGO: { name, reference } } con el nombre limpio y la referencia que
 * el sistema anterior pegaba al nombre (oficio, ciudad, quién lo recomendó).
 * @returns {{ cobro:string, worker:string, cards:Array, rejected:Array, totals:{count,people,principal,total,balance,paid,payments} }}
 */
export function convertLegacyExport(raw, routeId, importedAt = new Date().toISOString(), corrections = {}) {
  if (!raw || !Array.isArray(raw.tarjetas)) throw new Error('El archivo no es una exportación del sistema anterior (falta la lista «tarjetas»).');
  const tarjetas = raw.tarjetas.map(legacyCardRows);
  const results = tarjetas.map(card => convertLegacyCard(card, routeId, importedAt, corrections[legacyText(card?.TAR_CODIGO).toUpperCase()]));
  const cards = results.filter(result => result.client);
  const rejected = results.filter(result => result.error);
  const totals = cards.reduce((sum, { client }) => ({
    count: sum.count + 1,
    principal: sum.principal + client.principal,
    total: sum.total + client.total,
    balance: sum.balance + client.balance,
    paid: sum.paid + client.totalPaidAmount,
    payments: sum.payments + client.payments.length,
  }), { count: 0, principal: 0, total: 0, balance: 0, paid: 0, payments: 0 });
  totals.people = new Set(cards.map(({ client }) => personKey(client.id) || client.name)).size;
  const cobro = legacyRow(raw.cobro) || {};
  return { cobro: legacyText(cobro.COB_CODIGO), worker: legacyText(cobro.COB_NOMBRE), cards, rejected, totals };
}
