/**
 * domain/loan-schedule · Reglas del crédito: ciclos de pago, vencimientos,
 * comportamiento de pago y archivado de historiales. Sin acceso al DOM.
 */

import { paymentFrequencyDays } from '../core/config.js';
import { clients, persistBusinessData } from '../core/store.js';
import { dayDifference, localDate, localDateISO } from '../shared/dates.js';
import { blendColor } from '../shared/format.js';

export function inferClientPrincipal(client) {
  if (Number.isFinite(Number(client.principal)) && Number(client.principal) > 0) return Number(client.principal);
  const stated = String(client.breakdown || '').split('/')[0].match(/[\d.]+/);
  if (stated) return Number(stated[0].replace(/\./g, ''));
  return Math.round(Number(client.total || 0) / (1 + Number(client.interestPercent ?? 20) / 100));
}

export function pruneExpiredPaymentHistories() {
  let changed = false;
  Object.values(clients).forEach(client => {
    client.payments ||= [];
    if (client.totalPaidAmount == null) client.totalPaidAmount = client.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    if (Number(client.balance) <= 0) {
      if (!client.settledAt) { client.settledAt = localDateISO(); changed = true; }
      if (dayDifference(client.settledAt, localDateISO()) >= 7 && client.payments.length) {
        client.totalPaidAmount = client.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
        client.payments = [];
        client.archivedPaymentsAt = localDateISO();
        changed = true;
      }
    } else if (client.settledAt) { client.settledAt = null; changed = true; }
  });
  if (changed && typeof persistBusinessData === 'function') persistBusinessData();
}

export function updatePaidAmountTotal(client) {
  client.totalPaidAmount = (client.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

export function normalizeClientSchedules() {
  const today = new Date();
  Object.values(clients).forEach(client => {
    if (!paymentFrequencyDays[client.frequency]) client.frequency = 'weekly';
    if (!client.creditStartDate) {
      const started = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      started.setDate(started.getDate() - Math.max(0, Number(client.routeDay || 1) - 1));
      client.creditStartDate = localDateISO(started);
    }
    if (!Array.isArray(client.visitHistory)) client.visitHistory = [];
    if (!Array.isArray(client.paidPeriodIndexes)) client.paidPeriodIndexes = [];
    if (typeof client.paymentWarning !== 'boolean') client.paymentWarning = false;
    if (!Number.isFinite(Number(client.schedulePaidBaseline))) client.schedulePaidBaseline = Number(client.paid || 0);
  });
}

export function paymentCycleIndex(client, dateValue = localDateISO()) {
  let cycle = 0;
  while (cycle < 10000 && dateValue > paymentDueDate(client, cycle)) cycle += 1;
  return cycle;
}

export function paymentDueDate(client, cycleIndex) {
  const start = localDate(client.creditStartDate || localDateISO());
  if (client.frequency !== 'monthly') {
    start.setDate(start.getDate() + (cycleIndex + 1) * (paymentFrequencyDays[client.frequency] || 7));
    return localDateISO(start);
  }
  const originalDay = start.getDate();
  const monthStart = new Date(start.getFullYear(), start.getMonth() + cycleIndex + 1, 1);
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  monthStart.setDate(Math.min(originalDay, lastDay));
  return localDateISO(monthStart);
}

export function paymentAmountForCycle(client, cycleIndex) {
  return (client.payments || []).reduce((total, payment) => {
    const index = Number.isInteger(payment.cycleIndex) ? payment.cycleIndex : paymentCycleIndex(client, payment.date);
    return index === cycleIndex ? total + Number(payment.amount || 0) : total;
  }, 0);
}

export function currentCyclePaymentAmount(client) {
  return paymentAmountForCycle(client, paymentCycleIndex(client));
}

/**
 * Clasifica el comportamiento de pago de un crédito.
 * tier: 'good' (al día) · 'regular' (historial irregular o atraso < medio período ×2)
 *       · 'bad' (atraso de al menos un período completo). Lo usan la biblioteca y el mapa.
 */
/**
 * Foto del calendario de pagos: cuántas cuotas ya vencieron, cuántas están pagadas y
 * cuántos períodos van atrasados (según la frecuencia: diaria, semanal, quincenal o mensual).
 */
function scheduleSnapshot(client) {
  const today = localDateISO();
  const installments = Number(client.installments || 0) || Infinity;
  let dueCount = 0;        // cuotas con fecha <= hoy (incluye la que vence hoy)
  let overdueDueCount = 0; // cuotas con fecha < hoy (ya vencidas)
  while (dueCount < 10000 && dueCount < installments && paymentDueDate(client, dueCount) <= today) {
    if (paymentDueDate(client, dueCount) < today) overdueDueCount += 1;
    dueCount += 1;
  }
  const cycleSums = new Map();
  (client.payments || []).forEach(payment => {
    const cycle = Number.isInteger(payment.cycleIndex) ? payment.cycleIndex : paymentCycleIndex(client, payment.date);
    cycleSums.set(cycle, (cycleSums.get(cycle) || 0) + Number(payment.amount || 0));
  });
  const completedCycles = new Set([...cycleSums].filter(([, amount]) => amount >= Number(client.installment || 0)).map(([cycle]) => cycle));
  let sequentialPaidCycles = 0;
  while (completedCycles.has(sequentialPaidCycles)) sequentialPaidCycles += 1;
  const paidCount = Math.min(Number(client.installments || 0), Math.max(Number(client.schedulePaidBaseline || 0), sequentialPaidCycles));
  const settled = Number(client.balance) <= 0;
  const missingCount = settled ? 0 : Math.max(0, dueCount - paidCount);
  const overduePeriods = settled ? 0 : Math.max(0, overdueDueCount - paidCount);
  const firstMissingCycle = Math.min(Math.max(0, paidCount), Math.max(0, dueCount - 1));
  const overdueDays = missingCount > 0 ? Math.max(0, dayDifference(paymentDueDate(client, firstMissingCycle), today)) : 0;
  const latePaidCycles = [...cycleSums.entries()].filter(([cycle, amount]) => {
    if (amount < Number(client.installment || 0)) return false;
    const deadline = paymentDueDate(client, cycle);
    const dates = (client.payments || []).filter(payment => (Number.isInteger(payment.cycleIndex) ? payment.cycleIndex : paymentCycleIndex(client, payment.date)) === cycle).map(payment => payment.date).sort();
    const lastPaymentDate = dates[dates.length - 1];
    return lastPaymentDate && lastPaymentDate > deadline;
  }).length;
  const missedVisits = (client.visitHistory || []).filter(item => item.outcome === 'no-payment').length;
  return { settled, missingCount, overduePeriods, overdueDays, latePaidCycles, missedVisits, dueToday: missingCount > overduePeriods };
}

/**
 * Estado ACTUAL de pagos (lo que se ve desde afuera: listas, Inicio y mapa).
 * Cuenta los pagos atrasados por período según la frecuencia de la cartulina:
 * una semana sin pagar en una semanal = «Pagos atrasados 1»; dos meses en una mensual = 2.
 * tier: good (al día) · regular (1 pago atrasado) · bad (2 o más).
 */
export function paymentBehavior(client) {
  const snap = scheduleSnapshot(client);
  const explicitlyMissed = snap.missedVisits > 0;
  const latePaid = snap.latePaidCycles > 0;
  const base = { overdueDays: snap.overdueDays, missingCount: snap.missingCount, overduePeriods: snap.overduePeriods, latePaid, explicitlyMissed,
    warning: Boolean(client.paymentWarning || snap.overduePeriods > 0 || latePaid || explicitlyMissed) };
  if (snap.settled) return { ...base, tier: 'good', color: '#00C853', label: 'Cartulina pagada' };
  if (snap.overduePeriods >= 2) return { ...base, tier: 'bad', color: '#E53935', label: `Pagos atrasados ${snap.overduePeriods}` };
  if (snap.overduePeriods === 1) return { ...base, tier: 'regular', color: '#FF9800', label: 'Pagos atrasados 1' };
  if (snap.dueToday) return { ...base, tier: 'good', color: '#00C853', label: 'Cuota vence hoy' };
  return { ...base, tier: 'good', color: '#00C853', label: 'Pagos al día' };
}

const HISTORY_RANK = { good: 0, irregular: 1, bad: 2 };

/**
 * HISTORIAL de la cartulina (la «cicatriz» que se ve al entrar a la ficha).
 * Se queda aunque la deuda llegue a cero: un atraso pasado no se borra.
 *  - Historial bueno: nunca se atrasó.
 *  - Historial irregular: 1 o 2 incidentes (cuota pagada tarde, visita sin pago o 1 período atrasado).
 *  - Historial malo: 3 o más incidentes, o 2 o más períodos atrasados a la vez.
 */
export function paymentHistory(client) {
  const snap = scheduleSnapshot(client);
  const incidents = snap.latePaidCycles + snap.missedVisits + snap.overduePeriods;
  let level = snap.overduePeriods >= 2 || incidents >= 3 ? 'bad' : incidents >= 1 || client.paymentWarning ? 'irregular' : 'good';
  // La cicatriz nunca mejora: se conserva el peor nivel alcanzado.
  if (HISTORY_RANK[client.worstHistory] > HISTORY_RANK[level]) level = client.worstHistory;
  const meta = {
    good: { color: '#00C853', label: 'Historial bueno', detail: 'Ha pagado siempre dentro de la frecuencia acordada.' },
    irregular: { color: '#F9A825', label: 'Historial irregular', detail: 'Tuvo atrasos o pagos tardíos en esta cartulina.' },
    bad: { color: '#E53935', label: 'Historial malo', detail: 'Acumuló varios atrasos en esta cartulina.' },
  }[level];
  return { level, incidents, ...meta };
}

/** Guarda el peor nivel de historial alcanzado (la cicatriz persiste). */
export function rememberWorstHistory(client) {
  const { level } = paymentHistory(client);
  if (HISTORY_RANK[level] > (HISTORY_RANK[client.worstHistory] ?? -1)) client.worstHistory = level;
  if (level !== 'good') client.paymentWarning = true;
  return level;
}
