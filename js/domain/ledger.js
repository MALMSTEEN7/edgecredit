/**
 * domain/ledger · Libro diario de cada cobro (ruta) y caja del cobro.
 *
 * - `route.ledger[yyyy-mm-dd]` guarda los datos de cada día: base, cobro, préstamos,
 *   gastos, otros gastos, efectivo, salida de caja y seguros. Se escribe al cerrar el
 *   cobro («Verificar y cerrar ruta») y se puede corregir desde Reportes (gastos, otros
 *   gastos y salida de caja). Nada se borra: cualquier fecha se puede consultar después.
 * - El día de hoy, mientras no se cierre, se lee de los valores vivos de la ruta.
 * - `route.cashBox` es la CAJA del cobro: el monto de apertura (dinero disponible para
 *   prestar). No se reinicia nunca; cada día suma el cobro y resta préstamos, gastos,
 *   otros gastos y salidas de caja.
 * - `route.insuranceCuts` registra cada «Cuadrar seguros».
 * - Días traídos del sistema anterior (Excel): `cashAdjustment` es el ajuste de caja de ese
 *   día (descuadre entregado de más o de menos, o un ingreso de capital) para que la caja
 *   quede igual a la del Excel. Lo explica `adjustmentNote`. Los días de EdgeCredit no lo usan.
 */

import { localDateISO, shiftDateISO } from '../shared/dates.js';

export const DAY_FIELDS = ['base', 'collections', 'loans', 'expenses', 'otherExpenses', 'cashDelivered', 'cashOut', 'insurance'];
const LIVE_FIELDS = ['base', 'collections', 'loans', 'expenses', 'otherExpenses', 'cashDelivered'];
export const EDITABLE_FIELDS = ['expenses', 'otherExpenses', 'cashOut'];

export function ensureLedger(route) {
  if (!route) return route;
  route.ledger ||= {};
  route.cashBox ||= { opening: 0, openingDate: null };
  route.insuranceCuts ||= [];
  return route;
}

function closedToday(route) {
  return route.lastClosure?.date === localDateISO();
}

/** Datos de un día. Hoy sin cerrar = valores vivos de la ruta (+ salida de caja anotada). */
export function dayRecord(route, dateISO, liveInsurance = 0) {
  ensureLedger(route);
  const stored = route.ledger[dateISO];
  const today = localDateISO();
  if (dateISO === today && !closedToday(route)) {
    const live = Object.fromEntries(LIVE_FIELDS.map(field => [field, Number(route[field] || 0)]));
    return { ...live, cashOut: Number(stored?.cashOut || 0), insurance: liveInsurance, closed: false, live: true };
  }
  if (!stored) return { ...Object.fromEntries(DAY_FIELDS.map(field => [field, 0])), closed: false, empty: true };
  return {
    ...Object.fromEntries(DAY_FIELDS.map(field => [field, Number(stored[field] || 0)])),
    cashAdjustment: Number(stored.cashAdjustment || 0), adjustmentNote: stored.adjustmentNote || '',
    closed: Boolean(stored.closed), demo: Boolean(stored.demo),
  };
}

/** Descuadre del día (fórmula de la liquidación). Solo aplica a días cerrados. */
export function ledgerDifference(record) {
  if (!record.closed) return null;
  return record.collections + record.base - record.loans - record.expenses - record.otherExpenses - record.cashDelivered;
}

/** Movimiento de la caja del cobro en un día. */
export function cashBoxMovement(record) {
  return record.collections - record.loans - record.expenses - record.otherExpenses - record.cashOut + Number(record.cashAdjustment || 0);
}

/** Caja al cierre del día indicado (incluye hoy en vivo si la fecha llega a hoy). */
export function cashBoxAt(route, dateISO, liveInsurance = 0) {
  ensureLedger(route);
  const { opening, openingDate } = route.cashBox;
  if (!openingDate || dateISO < openingDate) return null;
  const today = localDateISO();
  let total = Number(opening || 0);
  Object.keys(route.ledger).forEach(date => {
    if (date < openingDate || date > dateISO) return;
    if (date === today && !closedToday(route)) return; // hoy se suma en vivo abajo
    total += cashBoxMovement(dayRecord(route, date));
  });
  if (today >= openingDate && today <= dateISO && !closedToday(route)) total += cashBoxMovement(dayRecord(route, today, liveInsurance));
  return total;
}

/** Guarda el día al cerrar el cobro (antes de reiniciar los valores vivos). */
export function recordClosure(route, dateISO, values, closedTs) {
  ensureLedger(route);
  const previous = route.ledger[dateISO] || {};
  route.ledger[dateISO] = {
    ...previous,
    ...Object.fromEntries(LIVE_FIELDS.map(field => [field, Number(values[field] || 0)])),
    insurance: Number(previous.closed ? previous.insurance || 0 : 0) + Number(values.insurance || 0),
    cashOut: Number(previous.cashOut || 0),
    closed: true,
    closedTs,
    demo: false,
  };
}

/** Corrige gastos, otros gastos o salida de caja de un día. Hoy sin cerrar: va a la ruta viva. */
export function setDayField(route, dateISO, field, value) {
  if (!EDITABLE_FIELDS.includes(field)) return;
  ensureLedger(route);
  const amount = Math.max(0, Math.round(Number(value) || 0));
  if (dateISO === localDateISO() && !closedToday(route) && field !== 'cashOut') {
    route[field] = amount;
    return;
  }
  route.ledger[dateISO] ||= { closed: false };
  route.ledger[dateISO][field] = amount;
  if (route.ledger[dateISO].demo) route.ledger[dateISO].edited = true;
}

// ── Seguros: entradas por día y cortes («Cuadrar seguros») ──

function monthStartTs(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month - 1, 1).getTime();
}

function monthEndTs(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month, 1).getTime() - 1;
}

/**
 * Seguros del día como movimientos con hora: los días cerrados toman la hora del
 * cierre; hoy (en vivo) toma la hora de cada alta.
 */
export function insuranceEntries(route, liveEntries = []) {
  ensureLedger(route);
  const entries = Object.entries(route.ledger)
    .filter(([, record]) => Number(record.insurance) > 0)
    .map(([date, record]) => ({ date, ts: Number(record.closedTs) || new Date(`${date}T19:00:00`).getTime(), amount: Number(record.insurance) }));
  return entries.concat(liveEntries).sort((a, b) => a.ts - b.ts);
}

/** Fin del periodo de seguros de un mes: el último cuadre hecho en ese mes o, si no hubo, fin de mes. */
function periodEnd(route, monthValue) {
  const start = monthStartTs(monthValue);
  const end = monthEndTs(monthValue);
  const cuts = route.insuranceCuts.filter(cut => cut.ts >= start && cut.ts <= end);
  return cuts.length ? Math.max(...cuts.map(cut => cut.ts)) : end;
}

function previousMonth(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Bolsa de seguros del mes. Empieza donde terminó la del mes anterior: si el mes anterior
 * se cuadró antes de fin de mes, lo cobrado después de ese cuadre pasa a este mes.
 */
export function insurancePeriod(route, monthValue, liveEntries = []) {
  ensureLedger(route);
  const from = periodEnd(route, previousMonth(monthValue));
  const to = periodEnd(route, monthValue);
  const all = insuranceEntries(route, liveEntries);
  const inPeriod = all.filter(entry => entry.ts > from && entry.ts <= to);
  const start = monthStartTs(monthValue);
  const carried = inPeriod.filter(entry => entry.ts < start).reduce((sum, entry) => sum + entry.amount, 0);
  const total = inPeriod.reduce((sum, entry) => sum + entry.amount, 0);
  const cuts = route.insuranceCuts.filter(cut => cut.ts >= start && cut.ts <= monthEndTs(monthValue)).sort((a, b) => a.ts - b.ts);
  const lastCut = cuts.at(-1) || null;
  // Lo cobrado en este mes después del último cuadre pasa al mes siguiente.
  const rollover = lastCut ? all.filter(entry => entry.ts > lastCut.ts && entry.ts <= monthEndTs(monthValue)).reduce((sum, entry) => sum + entry.amount, 0) : 0;
  return { entries: inPeriod, total, carried, cuts, lastCut, rollover, from, to };
}

function monthOf(ts) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Seguros que se cuadrarían en el instante `cutTs`: lo cobrado desde el límite anterior
 * (fin del periodo del mes previo o el último cuadre antes de ese instante).
 */
export function insuranceDueAt(route, cutTs, liveEntries = []) {
  ensureLedger(route);
  const since = Math.max(
    periodEnd(route, previousMonth(monthOf(cutTs))),
    ...route.insuranceCuts.filter(cut => cut.ts < cutTs && monthOf(cut.ts) === monthOf(cutTs)).map(cut => cut.ts),
  );
  return insuranceEntries(route, liveEntries).filter(entry => entry.ts > since && entry.ts <= cutTs).reduce((sum, entry) => sum + entry.amount, 0);
}

/** Quita el último cuadre del mes indicado (solo en modo de prueba). */
export function undoLastInsuranceCut(route, monthValue) {
  ensureLedger(route);
  const cuts = route.insuranceCuts.filter(cut => monthOf(cut.ts) === monthValue).sort((a, b) => a.ts - b.ts);
  const last = cuts.at(-1);
  if (!last) return null;
  route.insuranceCuts = route.insuranceCuts.filter(cut => cut !== last);
  return last;
}

/** Registra un cuadre de seguros ahora. */
export function cutInsurance(route, amount, by = 'Administrador', ts = Date.now()) {
  ensureLedger(route);
  const cut = { ts, date: localDateISO(new Date(ts)), amount: Math.round(Number(amount) || 0), by };
  route.insuranceCuts.push(cut);
  return cut;
}
