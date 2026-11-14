/**
 * domain/insurance · Seguros del crédito.
 *
 * Regla general: 10% del capital prestado. El trabajador (o el admin) puede cobrar
 * un valor distinto en pesos, siempre con un comentario que lo justifique. Los
 * seguros se cobran al entregar el préstamo, así que entran a la caja ese mismo día.
 */

import { roundToThousand } from '../shared/math.js';

export const GENERAL_INSURANCE_PERCENT = 10;

/** 10% del capital, redondeado a miles (22.300 → 22.000; 22.600 → 23.000). */
export function generalInsuranceAmount(principal) {
  return roundToThousand((Number(principal) || 0) * GENERAL_INSURANCE_PERCENT / 100);
}

/** Seguros de una cartulina, compatible con datos antiguos guardados en porcentaje. */
export function clientInsurance(client) {
  const principal = Number(client?.principal) || 0;
  if (client && client.insuranceAmount != null) {
    return { amount: Number(client.insuranceAmount) || 0, custom: Boolean(client.insuranceCustom), reason: client.insuranceReason || '' };
  }
  if (client?.insurancePercent != null) {
    return { amount: Math.round(principal * Number(client.insurancePercent) / 100), custom: Number(client.insurancePercent) !== GENERAL_INSURANCE_PERCENT, reason: client.insuranceReason || '' };
  }
  return { amount: generalInsuranceAmount(principal), custom: false, reason: '' };
}

/**
 * Valida y normaliza lo que el usuario escribió.
 * @returns {{amount:number, custom:boolean, reason:string} | {error:string}}
 */
export function resolveInsurance(principal, wantsCustom, rawAmount, rawReason) {
  const general = generalInsuranceAmount(principal);
  if (!wantsCustom) return { amount: general, custom: false, reason: '' };
  const amount = Math.round(Number(rawAmount));
  if (String(rawAmount ?? '').trim() === '' || !Number.isFinite(amount) || amount < 0) return { error: 'Escribe el valor de los seguros en pesos.' };
  if (amount > Number(principal)) return { error: 'Los seguros no pueden superar el monto del préstamo.' };
  if (amount === general) return { amount: general, custom: false, reason: '' };
  const reason = String(rawReason || '').trim();
  if (reason.length < 5) return { error: 'Explica por qué los seguros son diferentes al 10% general.' };
  return { amount, custom: true, reason };
}

/** Momento en que se cobraron los seguros (alta de la cartulina). */
function collectedTs(client, clientId) {
  if (client.insuranceCollectedTs) return Number(client.insuranceCollectedTs);
  const fromId = Number(String(clientId).match(/(\d{12,})/)?.[1]);
  return Number.isFinite(fromId) ? fromId : 0;
}

/**
 * Todos los seguros cobrados en una cartulina, con su fecha y hora: el de la entrega y los de
 * cada retanqueo (`extraInsurance`). Las cartulinas migradas del sistema anterior no cuentan su
 * seguro de entrega (se cobró allá), pero sí los retanqueos hechos en EdgeCredit.
 */
function allInsuranceEntriesOf(client, clientId) {
  const entries = [];
  if (client.insuranceCollectedAt && !client.importedFrom) {
    entries.push({ clientId, kind: 'alta', date: client.insuranceCollectedAt, ts: collectedTs(client, clientId) || Date.parse(`${client.insuranceCollectedAt}T12:00:00`), amount: Number(client.insuranceAmount) || 0 });
  }
  (client.extraInsurance || []).forEach((extra, index) => {
    if (extra.date && Number(extra.amount) > 0) entries.push({ clientId, kind: 'retanqueo', index, date: extra.date, ts: Number(extra.ts) || Date.parse(`${extra.date}T12:00:00`), amount: Number(extra.amount) });
  });
  return entries;
}

/**
 * Seguros que aún no entran a un cierre de ruta: los cobrados después del último cierre
 * (`cutoff` = { date, ts } de domain/ledger · closureCutoff), aunque sean de días anteriores en
 * que la ruta no se cerró (rutas que se pasan un día de por medio). Se van sumando hasta que se
 * guarda el cobro; ahí vuelven a cero. Sin ningún cierre, solo cuentan los de hoy.
 */
export function pendingInsuranceEntries(clients, routeId, cutoff, today, route = null) {
  const pending = entry => entry.date <= today && (cutoff
    ? entry.date > cutoff.date || (entry.date === cutoff.date && Boolean(cutoff.ts) && entry.ts > cutoff.ts)
    : entry.date === today);
  return Object.entries(clients)
    .filter(([, client]) => client && client.route === routeId)
    .flatMap(([clientId, client]) => allInsuranceEntriesOf(client, clientId))
    .concat(routeExtraInsuranceEntries(route))
    .filter(pending);
}

/**
 * Seguros adicionales del cobro: los registra el admin en el cuadre de caja, aparte de los
 * seguros de cada préstamo (no pertenecen a ningún cliente). Suman a la base y a los reportes.
 */
export function routeExtraInsuranceEntries(route) {
  return (route?.extraInsurance || [])
    .filter(extra => extra && extra.date && Number(extra.amount) > 0)
    .map(extra => ({ kind: 'adicional', id: extra.id, date: extra.date, ts: Number(extra.ts) || Date.parse(`${extra.date}T12:00:00`), amount: Number(extra.amount), note: extra.note || '' }));
}

/** Total y cantidad de los seguros pendientes de cierre (ver pendingInsuranceEntries). */
export function insurancePendingClose(clients, routeId, cutoff, today, route = null) {
  return pendingInsuranceEntries(clients, routeId, cutoff, today, route)
    .reduce((sum, entry) => ({ total: sum.total + entry.amount, count: sum.count + 1 }), { total: 0, count: 0 });
}

