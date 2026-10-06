/**
 * features/worker/cash-box · Caja del trabajador: base de trabajo (efectivo/bancos)
 * y métricas del día.
 */

import { baseInput, cashTotal } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData, routeSettlements, shared } from '../../core/store.js';
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

export function updateCashTotal() {
  const balanceValues = document.querySelectorAll('.cash-balances .balance-item strong');
  const today = todayCollectionsByMethod();
  // Tu caja hoy = base de trabajo + abonos recibidos hoy (efectivo y bancos por separado).
  balanceValues[0].textContent = formatMoney(state.workBaseCash + today.cash);
  balanceValues[1].textContent = formatMoney(state.workBaseBank + today.bank);
  cashTotal.textContent = formatMoney(state.workBaseAmount + today.cash + today.bank);
  updateCashChip(cashTotal.textContent);
  renderWorkerDailyMetrics();
}

function persistWorkBase() {
  const id = state.activeWorker?.id || 'default';
  shared.workBases[id] = { amount: state.workBaseAmount, cash: state.workBaseCash, bank: state.workBaseBank, account: state.workBaseAccount, updatedAt: new Date().toISOString() };
  persistBusinessData();
}

export function loadWorkBase(worker) {
  state.workBaseCash = 0; state.workBaseBank = 0; state.workBaseAmount = 0; state.workBaseAccount = 'cash';
  try {
    const saved = shared.workBases[worker?.id || 'default'] || null;
    if (saved && typeof saved === 'object') {
      state.workBaseCash = Math.max(0, Number(saved.cash) || 0);
      state.workBaseBank = Math.max(0, Number(saved.bank) || 0);
      if (!('cash' in saved) && !('bank' in saved)) {
        const amount = Math.max(0, Number(saved.amount) || 0);
        if (saved.account === 'bank') state.workBaseBank = amount; else state.workBaseCash = amount;
      }
      state.workBaseAccount = saved.account === 'bank' ? 'bank' : 'cash';
    } else state.workBaseCash = Math.max(0, Number(worker?.openingAmount) || 0);
  } catch { state.workBaseCash = Math.max(0, Number(worker?.openingAmount) || 0); }
  state.workBaseAmount = state.workBaseCash + state.workBaseBank;
  document.querySelector('#work-base-account').value = state.workBaseAccount;
}

export function deductWorkBase(amount) {
  let remaining = Math.max(0, Number(amount) || 0);
  const cashDeduction = Math.min(state.workBaseCash, remaining);
  state.workBaseCash -= cashDeduction;
  remaining -= cashDeduction;
  state.workBaseBank = Math.max(0, state.workBaseBank - remaining);
  state.workBaseAmount = state.workBaseCash + state.workBaseBank;
  updateCashTotal();
  persistWorkBase();
}

/** Suma dinero cobrado en campo (p. ej. seguros) a la base en efectivo del trabajador. */
export function addToWorkBase(amount) {
  const value = Math.max(0, Math.round(Number(amount) || 0));
  if (!value) return;
  state.workBaseCash += value;
  state.workBaseAmount = state.workBaseCash + state.workBaseBank;
  updateCashTotal();
  persistWorkBase();
}

export function renderWorkerDailyMetrics() {
  const route = routeSettlements[state.workerRoute];
  if (!route) return;
  document.querySelector('#worker-metrics-route').textContent = `Ruta ${route.name}`;
  document.querySelector('#worker-day-base').textContent = formatMoney(state.workBaseAmount);
  document.querySelector('#worker-day-collections').textContent = formatMoney(route.collections || 0);
  document.querySelector('#worker-day-expenses').textContent = formatMoney(route.expenses || 0);
  document.querySelector('#worker-day-other-expenses').textContent = formatMoney(route.otherExpenses || 0);
  document.querySelector('#worker-day-loans').textContent = formatMoney(route.loans || 0);
  // Seguros cobrados hoy en la ruta: ya están sumados a la base del día (addToWorkBase).
  // Tras «Verificar y cerrar ruta» el resumen arranca de cero: solo cuenta lo posterior al cierre.
  const closure = route.lastClosure?.date === localDateISO() ? Date.parse(route.lastClosure.submittedAt) : 0;
  const insurance = insuranceCollectedOn(clients, state.workerRoute, localDateISO(), closure);
  document.querySelector('#worker-day-insurance').textContent = formatMoney(insurance.total);
  document.querySelector('#worker-day-insurance-count').textContent = insurance.count ? `${insurance.count} préstamo${insurance.count === 1 ? '' : 's'} entregado${insurance.count === 1 ? '' : 's'} hoy` : 'Sin seguros cobrados hoy';
  const baseNote = document.querySelector('#worker-day-base-insurance');
  baseNote.hidden = !insurance.total;
  baseNote.textContent = insurance.total ? `Incluye ${formatMoney(insurance.total)} de seguros` : '';
  document.querySelector('#worker-day-cash').textContent = formatMoney(route.cashDelivered || (state.workBaseCash + route.collections - route.loans - route.expenses - route.otherExpenses));
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
    state.workBaseAccount = document.querySelector('#work-base-account').value;
    if (state.workBaseAccount === 'bank') state.workBaseBank += Math.round(value);
    else state.workBaseCash += Math.round(value);
    state.workBaseAmount = state.workBaseCash + state.workBaseBank;
    baseInput.value = '';
    updateCashTotal();
    persistWorkBase();
    showToast(`${formatMoney(value)} agregado a la base de ${state.workBaseAccount === 'bank' ? 'bancos' : 'efectivo'}.`);
  });
  document.querySelector('#work-base-account').addEventListener('change', () => { state.workBaseAccount = document.querySelector('#work-base-account').value; persistWorkBase(); });
}
