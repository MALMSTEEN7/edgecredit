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
 * Seguros cobrados en una ruta en la fecha indicada (cartulinas entregadas ese día).
 * `sinceTs`: si el cobro ya se cerró hoy, solo cuenta lo cobrado después del cierre.
 */
export function insuranceCollectedOn(clients, routeId, dateISO, sinceTs = 0) {
  return Object.entries(clients).reduce((sum, [clientId, client]) => {
    if (!client || client.route !== routeId || client.insuranceCollectedAt !== dateISO) return sum;
    if (sinceTs && collectedTs(client, clientId) <= sinceTs) return sum;
    return { total: sum.total + (Number(client.insuranceAmount) || 0), count: sum.count + 1 };
  }, { total: 0, count: 0 });
}

/** Seguros cobrados hoy (aún sin cierre) como movimientos individuales con su hora. */
export function liveInsuranceEntries(clients, routeId, dateISO, sinceTs = 0) {
  return Object.entries(clients)
    .filter(([, client]) => client && client.route === routeId && client.insuranceCollectedAt === dateISO && Number(client.insuranceAmount) > 0)
    .map(([clientId, client]) => ({ date: dateISO, ts: collectedTs(client, clientId) || Date.now(), amount: Number(client.insuranceAmount) }))
    .filter(entry => !sinceTs || entry.ts > sinceTs);
}
