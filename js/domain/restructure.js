/**
 * domain/restructure · Cambios a una cartulina con saldo, hechos por el admin.
 *
 * - Financiar: se le suman intereses por pasarse de los días acordados y se le da un plazo nuevo.
 * - Retanqueo: se le presta más antes de terminar de pagar; al monto extra se le suman intereses
 *   (20 % general) y se cobran seguros (10 % general), salvo que el admin ponga otro valor.
 *
 * En los dos casos el saldo nuevo arranca un calendario nuevo desde hoy (cuotas y plazo nuevos)
 * y el total del crédito sube en lo agregado, así «abonado + saldo = total» sigue cuadrando.
 * Los abonos anteriores siguen en el historial, pero ya no cuentan para las cuotas nuevas.
 */

import { paymentFrequencyDays } from '../core/config.js';
import { localDateISO } from '../shared/dates.js';
import { formatMoney } from '../shared/format.js';
import { GENERAL_INSURANCE_PERCENT } from './insurance.js';

export const RETANQUEO_INTEREST_PERCENT = 20;
export const FINANCE_INTEREST_PERCENT = 20;
/** Seguros generales sobre el monto extra de un retanqueo (los mismos 10 % de un préstamo). */
export const GENERAL_RETANQUEO = { insurancePercent: GENERAL_INSURANCE_PERCENT };

/** Valor de un porcentaje o, si se escribió, el monto exacto. */
export function percentOrAmount(base, percent, exactAmount) {
  const exact = Number(exactAmount);
  if (String(exactAmount ?? '').trim() !== '' && Number.isFinite(exact) && exact >= 0) return Math.round(exact);
  return Math.round((Number(base) || 0) * (Number(percent) || 0) / 100);
}

/**
 * Inicio del calendario nuevo. Las semanales siguen pagando el mismo día de la semana
 * (y conservan su color): arrancan el último día con ese día de la semana hasta hoy.
 */
function restartDate(client, today) {
  const [year, month, day] = String(client.creditStartDate || '').split('-').map(Number);
  if ((client.frequency || 'weekly') !== 'weekly' || !year) return today;
  const [ty, tm, td] = today.split('-').map(Number);
  const start = new Date(ty, tm - 1, td);
  start.setDate(start.getDate() - ((start.getDay() - new Date(year, month - 1, day).getDay() + 7) % 7));
  return localDateISO(start);
}

/** Calendario nuevo desde hoy para el saldo actual. */
function restartSchedule(client, totalDays, today) {
  const days = Math.max(1, Math.round(Number(totalDays) || Number(client.totalDays) || 30));
  const frequencyDays = paymentFrequencyDays[client.frequency] || 7;
  const startDate = restartDate(client, today);
  const installments = Math.max(1, Math.ceil(days / frequencyDays));
  // Los abonos anteriores quedan fuera de las cuotas nuevas (ciclo −1).
  (client.payments || []).forEach(payment => { payment.cycleIndex = -1; payment.beforeRestructure = true; });
  Object.assign(client, {
    creditStartDate: startDate, totalDays: days, term: `${days} días`, routeDay: 1,
    installments, installment: Math.ceil(Number(client.balance) / installments),
    paid: 0, paidPeriodIndexes: [], schedulePaidBaseline: 0, late: false, status: 'Al día', settledAt: null,
  });
}

/** Financiar: suma `interest` al saldo y da un plazo nuevo de `totalDays` días desde hoy. */
export function financeCard(client, { interest, totalDays, by = 'Administrador', today = localDateISO() }) {
  const amount = Math.max(0, Math.round(Number(interest) || 0));
  const before = { balance: Number(client.balance), total: Number(client.total), totalDays: client.totalDays, creditStartDate: client.creditStartDate };
  client.balance = Number(client.balance) + amount;
  client.total = Number(client.total) + amount;
  client.interestHistory ||= [];
  if (amount) client.interestHistory.unshift({ date: today, amount, type: 'financiacion' });
  restartSchedule(client, totalDays, today);
  client.restructures ||= [];
  client.restructures.unshift({ type: 'financiacion', date: today, at: new Date().toISOString(), by, interest: amount, before });
  return { interest: amount, balance: client.balance };
}

/**
 * Retanqueo: presta `extra` más a la cartulina. El saldo sube en extra + intereses; los seguros
 * se cobran en efectivo hoy (entran a la base del día, como al entregar un préstamo).
 * Devuelve lo que hay que registrar en la liquidación del cobro.
 */
export function retanqueoCard(client, { extra, interest, insurance, insuranceReason = '', totalDays, by = 'Administrador', today = localDateISO(), now = Date.now() }) {
  const amount = Math.max(0, Math.round(Number(extra) || 0));
  const interestAmount = Math.max(0, Math.round(Number(interest) || 0));
  const insuranceAmount = Math.max(0, Math.round(Number(insurance) || 0));
  const before = { balance: Number(client.balance), total: Number(client.total), principal: Number(client.principal), totalDays: client.totalDays, creditStartDate: client.creditStartDate };
  client.principal = Number(client.principal || 0) + amount;
  client.balance = Number(client.balance) + amount + interestAmount;
  client.total = Number(client.total) + amount + interestAmount;
  client.breakdown = `${formatMoney(client.principal)} / ${formatMoney(client.total - client.principal)}`;
  if (insuranceAmount) {
    client.extraInsurance ||= [];
    client.extraInsurance.push({ date: today, ts: now, amount: insuranceAmount, reason: insuranceReason ? `Retanqueo · ${insuranceReason}` : 'Retanqueo' });
  }
  restartSchedule(client, totalDays, today);
  client.restructures ||= [];
  client.restructures.unshift({ type: 'retanqueo', date: today, at: new Date(now).toISOString(), by, extra: amount, interest: interestAmount, insurance: insuranceAmount, before });
  return { extra: amount, interest: interestAmount, insurance: insuranceAmount, balance: client.balance };
}

/**
 * Liquidación del cobro al hacer un retanqueo: el extra sale hoy como préstamo y los seguros
 * entran a la base del día (como al entregar un préstamo nuevo).
 */
export function recordRetanqueoInRoute(route, client, clientId, { extra, interest, insurance }) {
  if (!route) return;
  route.loans = Number(route.loans || 0) + extra;
  route.base = Number(route.base || 0) + insurance;
  route.monthlyInsurance = (Number(route.monthlyInsurance) || 0) + insurance;
  route.loansNew ||= [];
  route.loansEntered ||= [];
  route.loansNew.unshift({ name: `${client.name} (retanqueo)`, clientId, amount: extra });
  route.loansEntered.unshift({ name: `${client.name} (retanqueo)`, clientId, amount: extra + interest });
}

/** Solicitud pendiente de financiar o retanquear esta cartulina (o undefined). */
export function pendingRestructure(requests, clientId) {
  return requests.find(request => request.status === 'pending' && request.clientId === clientId && (request.type === 'finance' || request.type === 'retanqueo'));
}
