/**
 * domain/insurance · Seguros del crédito.
 *
 * Regla general: 10% del capital prestado. El trabajador (o el admin) puede cobrar
 * un valor distinto en pesos, siempre con un comentario que lo justifique. Los
 * seguros se cobran al entregar el préstamo, así que entran a la caja ese mismo día.
 */

export const GENERAL_INSURANCE_PERCENT = 10;

export function generalInsuranceAmount(principal) {
  return Math.round((Number(principal) || 0) * GENERAL_INSURANCE_PERCENT / 100);
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
 * Seguros cobrados en una cartulina en una fecha: los de la entrega y los de cada retanqueo
 * (`extraInsurance`). Las cartulinas migradas del sistema anterior no cuentan su seguro de
 * entrega (se cobró allá), pero sí los retanqueos hechos en EdgeCredit.
 */
function insuranceEntriesOf(client, clientId, dateISO) {
  const entries = [];
  if (client.insuranceCollectedAt === dateISO && !client.importedFrom) {
    entries.push({ date: dateISO, ts: collectedTs(client, clientId) || Date.now(), amount: Number(client.insuranceAmount) || 0 });
  }
  (client.extraInsurance || []).forEach(extra => {
    if (extra.date === dateISO && Number(extra.amount) > 0) entries.push({ date: dateISO, ts: Number(extra.ts) || Date.now(), amount: Number(extra.amount) });
  });
  return entries;
}

/**
 * Seguros cobrados en una ruta en la fecha indicada (cartulinas entregadas o retanqueadas ese día).
 * `sinceTs`: si el cobro ya se cerró hoy, solo cuenta lo cobrado después del cierre.
 */
export function insuranceCollectedOn(clients, routeId, dateISO, sinceTs = 0) {
  return routeInsuranceEntries(clients, routeId, dateISO, sinceTs)
    .reduce((sum, entry) => ({ total: sum.total + entry.amount, count: sum.count + 1 }), { total: 0, count: 0 });
}

function routeInsuranceEntries(clients, routeId, dateISO, sinceTs) {
  return Object.entries(clients)
    .filter(([, client]) => client && client.route === routeId)
    .flatMap(([clientId, client]) => insuranceEntriesOf(client, clientId, dateISO))
    .filter(entry => !sinceTs || entry.ts > sinceTs);
}

/** Seguros cobrados en la fecha (aún sin cierre) como movimientos individuales con su hora. */
export function liveInsuranceEntries(clients, routeId, dateISO, sinceTs = 0) {
  return routeInsuranceEntries(clients, routeId, dateISO, sinceTs).filter(entry => entry.amount > 0);
}
