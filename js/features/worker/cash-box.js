/**
 * features/worker/cash-box · Caja del trabajador (efectivo/bancos) y métricas del día.
 */

import { baseInput, cashTotal, customModalError } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, pendingRequests, persistBusinessData, routeDirectory, routeSettlements } from '../../core/store.js';
import { EXTERNAL_ROUTE, createBaseTransfer, creditDestination } from '../../domain/base-transfer.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { renderPendingRequests } from '../admin/pending.js';
import { insuranceCollectedOn } from '../../domain/insurance.js';
import { paymentStamp, pendingRoutePayments, syncRouteCollections } from '../../domain/ledger.js';
import { localDateISO } from '../../shared/dates.js';
import { formatMoney } from '../../shared/format.js';
import { showToast } from '../../ui/toast.js';
import { updateCashChip } from './home.js';
import { paymentCorrectionPending, requestPaymentCorrection } from '../daily-route/daily-route.js';

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
  renderBaseTransfers();
  renderWorkerDailyMetrics();
}

export function renderWorkerDailyMetrics() {
  const route = routeSettlements[state.workerRoute];
  if (!route) return;
  // Cobro = abonos registrados desde el último cierre (igual que «Abonos del día»).
  syncRouteCollections(clients, { [state.workerRoute]: route });
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
    const side = document.createElement('div');
    side.className = 'worker-day-payment-side';
    const amount = document.createElement('strong');
    amount.className = 'worker-day-payment-amount';
    amount.textContent = formatMoney(payment.amount);
    // Si se equivocaron en la cuota, la corrección se pide desde aquí mismo.
    const correction = document.createElement('button');
    correction.type = 'button';
    correction.className = 'worker-day-payment-fix';
    const pending = paymentCorrectionPending(clientId, payment);
    correction.textContent = pending ? 'Corrección enviada' : 'Solicitar corrección';
    correction.disabled = pending;
    correction.addEventListener('click', () => requestPaymentCorrection(clientId, payment, renderWorkerDayPayments));
    side.append(amount, correction);
    row.append(open, side);
    list.append(row);
  });
  const total = entries.reduce((sum, { payment }) => sum + (Number(payment.amount) || 0), 0);
  const earlier = entries.filter(({ payment }) => payment.date < today).length;
  document.querySelector('#worker-day-payments-count').textContent = entries.length
    ? `${entries.length} ${entries.length === 1 ? 'abono' : 'abonos'} · ${formatMoney(total)}${earlier ? ` · ${earlier} de días sin cerrar` : ''}`
    : 'Sin abonos';
}

// ── Traspaso de base a otro cobro ──

/** Cobros a los que se puede enviar base (la lista que publica el admin, sin el propio). */
function transferDestinations() {
  const own = state.workerRoute;
  const listed = routeDirectory.length ? routeDirectory : Object.entries(routeSettlements).map(([id, route]) => ({ id, name: route?.name || id }));
  return listed.filter(item => item.id && item.id !== own);
}

/** Traspasos de base del cobro desde el último cierre: enviados (−) y recibidos (+). */
function renderBaseTransfers() {
  const route = workerRoute();
  const list = document.querySelector('#base-transfer-list');
  if (!route || !list) return;
  const since = Date.parse(route.lastClosure?.submittedAt || '') || 0;
  const recent = entry => (Date.parse(entry.at) || 0) > since;
  const items = [
    ...(route.baseTransfersOut || []).filter(recent).map(entry => ({ ...entry, sign: -1, label: `Enviado a ${entry.toName || entry.to}` })),
    ...(route.baseTransfersIn || []).filter(recent).map(entry => ({ ...entry, sign: 1, label: `Recibido de ${entry.fromName || entry.from}` })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  list.hidden = !items.length;
  list.replaceChildren(...items.map(item => {
    const li = document.createElement('li');
    li.className = item.sign < 0 ? 'is-out' : 'is-in';
    const text = document.createElement('span');
    text.textContent = `${item.label} · ${new Date(item.at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
    const amount = document.createElement('strong');
    amount.textContent = `${item.sign < 0 ? '−' : '+'} ${formatMoney(item.amount)}`;
    li.append(text, amount);
    return li;
  }));
}

function openBaseTransfer() {
  const route = workerRoute();
  if (!route) return;
  const destinations = transferDestinations();
  const available = Math.max(0, cashInHand(route, todayCollectionsByMethod().cash));
  openCustomModal({
    title: 'Traspasar base a otro cobro',
    description: `Sale de tu efectivo (tienes ${formatMoney(available)}) y se le suma a la base del cobro que elijas. El administrador lo verá en Pendientes.`,
    fields: [
      { name: 'amount', label: 'Monto a traspasar ($)', type: 'number', money: true, thousands: true, min: 1, step: 1, required: true },
      { name: 'to', label: '¿A qué cobro?', type: 'select', required: true, options: [{ value: '', label: 'Elige el cobro' }, ...destinations.map(item => ({ value: item.id, label: item.name })), { value: EXTERNAL_ROUTE, label: 'Otro cobro (aún no está en EdgeCredit)' }] },
      { name: 'externalName', label: 'Nombre del cobro (solo si es «Otro cobro»)', placeholder: 'Ej. Cúcuta' },
      { name: 'comment', label: 'Comentario (opcional)', type: 'textarea', rows: 2, placeholder: 'Ej. Para préstamos de la tarde' },
    ],
    submitLabel: 'Traspasar',
    onSubmit: values => {
      const amount = Math.round(Number(values.amount));
      if (!Number.isFinite(amount) || amount <= 0) { customModalError.textContent = 'Escribe un monto mayor que cero.'; return false; }
      if (amount > available) { customModalError.textContent = `No tienes tanto efectivo: tienes ${formatMoney(available)}.`; return false; }
      if (!values.to) { customModalError.textContent = 'Elige a qué cobro va el dinero.'; return false; }
      const external = values.to === EXTERNAL_ROUTE;
      const toName = external ? String(values.externalName || '').trim() : destinations.find(item => item.id === values.to)?.name || values.to;
      if (external && toName.length < 2) { customModalError.textContent = 'Escribe el nombre del otro cobro.'; return false; }
      const request = createBaseTransfer({ origin: route, originId: state.workerRoute, toId: values.to, toName, amount, worker: state.activeWorker, comment: values.comment });
      // Sin servidor (o si este equipo tiene el cobro de destino) se acredita de una vez.
      creditDestination(request, routeSettlements);
      pendingRequests.unshift(request);
      persistBusinessData();
      updateCashTotal();
      renderPendingRequests();
      showToast(`${formatMoney(amount)} traspasados a ${toName}.`);
    },
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#base-transfer-open').addEventListener('click', openBaseTransfer);
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
