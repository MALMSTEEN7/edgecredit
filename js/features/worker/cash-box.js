/**
 * features/worker/cash-box · Caja del trabajador (efectivo/bancos) y métricas del día.
 */

import { baseInput, cashTotal } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData, routeSettlements } from '../../core/store.js';
import { insuranceCollectedOn } from '../../domain/insurance.js';
import { localDateISO } from '../../shared/dates.js';
import { formatMoney } from '../../shared/format.js';
import { showToast } from '../../ui/toast.js';
import { updateCashChip } from './home.js';

/** Abonos de hoy en la ruta del trabajador, separados por efectivo y transferencia. */
function todayCollectionsByMethod() {
  const today = localDateISO();
  return Object.values(clients).reduce((sum, client) => {
    if (!client || client.route !== state.workerRoute) return sum;
    (client.payments || []).forEach(payment => {
      if (payment.date !== today) return;
      if (payment.method === 'transfer') sum.bank += Number(payment.amount) || 0;
      else sum.cash += Number(payment.amount) || 0;
    });
    return sum;
  }, { cash: 0, bank: 0 });
}

/**
 * La base del día es una sola: la del cobro (`route.base`), la misma que ve el admin en
 * Liquidación. Incluye los seguros cobrados hoy y lo que el trabajador agregue a la base;
 * `route.baseBank` es la parte que agregó en bancos. Los préstamos no la cambian: se restan
 * una sola vez al calcular el efectivo.
 */
function workerRoute() {
  return routeSettlements[state.workerRoute] || null;
}

/** Efectivo que debería tener el trabajador ahora: base + cobros − préstamos − gastos − otros gastos. */
function cashInHand(route, todayCash) {
  const bankBase = Number(route.baseBank || 0);
  return Number(route.base || 0) - bankBase + todayCash - Number(route.loans || 0) - Number(route.expenses || 0) - Number(route.otherExpenses || 0);
}

export function updateCashTotal() {
  const balanceValues = document.querySelectorAll('.cash-balances .balance-item strong');
  const route = workerRoute();
  const today = todayCollectionsByMethod();
  const cash = route ? cashInHand(route, today.cash) : 0;
  const bank = (route ? Number(route.baseBank || 0) : 0) + today.bank;
  balanceValues[0].textContent = formatMoney(cash);
  balanceValues[1].textContent = formatMoney(bank);
  cashTotal.textContent = formatMoney(cash + bank);
  updateCashChip(cashTotal.textContent);
  renderWorkerDailyMetrics();
}

export function renderWorkerDailyMetrics() {
  const route = routeSettlements[state.workerRoute];
  if (!route) return;
  document.querySelector('#worker-metrics-route').textContent = `Ruta ${route.name}`;
  document.querySelector('#worker-day-base').textContent = formatMoney(route.base || 0);
  document.querySelector('#worker-day-collections').textContent = formatMoney(route.collections || 0);
  document.querySelector('#worker-day-expenses').textContent = formatMoney(route.expenses || 0);
  document.querySelector('#worker-day-other-expenses').textContent = formatMoney(route.otherExpenses || 0);
  document.querySelector('#worker-day-loans').textContent = formatMoney(route.loans || 0);
  // Seguros cobrados hoy en la ruta: ya están sumados a la base del día (new-client.js).
  // Tras «Verificar y cerrar ruta» el resumen arranca de cero: solo cuenta lo posterior al cierre.
  const closure = route.lastClosure?.date === localDateISO() ? Date.parse(route.lastClosure.submittedAt) : 0;
  const insurance = insuranceCollectedOn(clients, state.workerRoute, localDateISO(), closure);
  document.querySelector('#worker-day-insurance').textContent = formatMoney(insurance.total);
  document.querySelector('#worker-day-insurance-count').textContent = insurance.count ? `${insurance.count} préstamo${insurance.count === 1 ? '' : 's'} entregado${insurance.count === 1 ? '' : 's'} hoy` : 'Sin seguros cobrados hoy';
  const baseNote = document.querySelector('#worker-day-base-insurance');
  baseNote.hidden = !insurance.total;
  baseNote.textContent = insurance.total ? `Incluye ${formatMoney(insurance.total)} de seguros` : '';
  document.querySelector('#worker-day-cash').textContent = formatMoney(route.cashDelivered || (Number(route.base || 0) + Number(route.collections || 0) - Number(route.loans || 0) - Number(route.expenses || 0) - Number(route.otherExpenses || 0)));
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#save-work-base').addEventListener('click', () => {
    const value = Number(baseInput.value);
    if (!Number.isFinite(value) || value <= 0) {
      baseInput.setCustomValidity('Ingresa un incremento de base mayor que cero.');
      baseInput.reportValidity();
      baseInput.addEventListener('input', () => baseInput.setCustomValidity(''), { once: true });
      return;
    }
    const route = workerRoute();
    if (!route) return;
    const amount = Math.round(value);
    const toBank = document.querySelector('#work-base-account').value === 'bank';
    route.base = Number(route.base || 0) + amount;
    if (toBank) route.baseBank = Number(route.baseBank || 0) + amount;
    baseInput.value = '';
    persistBusinessData();
    updateCashTotal();
    showToast(`${formatMoney(amount)} agregado a la base de ${toBank ? 'bancos' : 'efectivo'}.`);
  });
}
