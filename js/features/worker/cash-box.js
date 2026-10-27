/**
 * features/worker/cash-box · Caja del trabajador (efectivo/bancos) y métricas del día.
 */

import { baseInput, cashTotal } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData, routeSettlements } from '../../core/store.js';
import { insuranceCollectedOn } from '../../domain/insurance.js';
import { paymentStamp, pendingRoutePayments } from '../../domain/ledger.js';
import { localDateISO } from '../../shared/dates.js';
import { formatMoney } from '../../shared/format.js';
import { showToast } from '../../ui/toast.js';
import { updateCashChip } from './home.js';

/** Momento en que se cerró hoy la ruta («Verificar y cerrar ruta»), o 0 si hoy no se ha cerrado. */
function todayClosureTs(route) {
  return route?.lastClosure?.date === localDateISO() ? Date.parse(route.lastClosure.submittedAt) || 0 : 0;
}

/**
 * Abonos de la ruta del trabajador pendientes de cierre (también los de días anteriores en que
 * no se cerró la ruta: siguen sumando en el cobro), por efectivo y transferencia. Los que ya
 * entraron a un cierre no se vuelven a sumar: ese efectivo ya pasó a la base y las
 * transferencias ya se liquidaron.
 */
function todayCollectionsByMethod() {
  return pendingRoutePayments(clients, state.workerRoute, workerRoute()).reduce((sum, { payment }) => {
    if (payment.method === 'transfer') sum.bank += Number(payment.amount) || 0;
    else sum.cash += Number(payment.amount) || 0;
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
  const closure = todayClosureTs(route);
  const insurance = insuranceCollectedOn(clients, state.workerRoute, localDateISO(), closure);
  document.querySelector('#worker-day-insurance').textContent = formatMoney(insurance.total);
  document.querySelector('#worker-day-insurance-count').textContent = insurance.count ? `${insurance.count} préstamo${insurance.count === 1 ? '' : 's'} entregado${insurance.count === 1 ? '' : 's'} hoy` : 'Sin seguros cobrados hoy';
  const baseNote = document.querySelector('#worker-day-base-insurance');
  baseNote.hidden = !insurance.total;
  baseNote.textContent = insurance.total ? `Incluye ${formatMoney(insurance.total)} de seguros` : '';
  renderWorkerDayPayments();
  // Efectivo del día = base + cobros − préstamos − gastos. Ya cerrada hoy la ruta, la base que
  // aparece es la de mañana (el efectivo del cierre): no se vuelve a contar como efectivo de hoy.
  const movements = Number(route.collections || 0) - Number(route.loans || 0) - Number(route.expenses || 0) - Number(route.otherExpenses || 0);
  document.querySelector('#worker-day-cash').textContent = formatMoney(closure ? movements : route.cashDelivered || Number(route.base || 0) + movements);
  const cashNote = document.querySelector('#worker-day-cash-note');
  cashNote.hidden = !closure;
  cashNote.textContent = closure ? 'Ruta cerrada hoy: solo lo que entre después del cierre' : '';
}

/**
 * Historial desplegable de los abonos pendientes de cierre (más reciente primero), igual que
 * los ve el admin: los de hoy y los de días anteriores en que no se cerró la ruta, con su fecha.
 */
function renderWorkerDayPayments() {
  const today = localDateISO();
  const entries = pendingRoutePayments(clients, state.workerRoute, workerRoute());
  const list = document.querySelector('#worker-day-payments-list');
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Todavía no hay abonos registrados hoy.';
    list.append(empty);
  }
  entries.forEach(({ clientId, client, payment }) => {
    const row = document.createElement('li');
    row.classList.toggle('is-earlier-day', payment.date < today);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'worker-day-payment-client';
    open.dataset.openClient = clientId;
    const name = document.createElement('strong');
    name.textContent = client.name;
    const detail = document.createElement('small');
    detail.textContent = [paymentStamp(payment), payment.method === 'transfer' ? 'Transferencia' : 'Efectivo'].join(' · ');
    open.append(name, detail);
    const amount = document.createElement('strong');
    amount.className = 'worker-day-payment-amount';
    amount.textContent = formatMoney(payment.amount);
    row.append(open, amount);
    list.append(row);
  });
  const total = entries.reduce((sum, { payment }) => sum + (Number(payment.amount) || 0), 0);
  const earlier = entries.filter(({ payment }) => payment.date < today).length;
  document.querySelector('#worker-day-payments-count').textContent = entries.length
    ? `${entries.length} ${entries.length === 1 ? 'abono' : 'abonos'} · ${formatMoney(total)}${earlier ? ` · ${earlier} de días sin cerrar` : ''}`
    : 'Sin abonos';
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
