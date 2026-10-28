/**
 * features/daily-route · Constructor de la ruta diaria: biblioteca (solo cartulinas activas),
 * orden de visitas e indicadores del día. Las visitas se cierran solas al registrar un abono
 * o "No pagó hoy" desde el Inicio; aquí solo se ven los indicadores y se pide revisión.
 */

import { state } from '../../core/state.js';
import { clients, pendingRequests, persistBusinessData, routeSettlements } from '../../core/store.js';
import { renderPendingRequests } from '../admin/pending.js';
import { clientAvatarWithProgress, filterClientCards, renderClientRows } from '../clients/directory.js';
import { localDate, localDateISO } from '../../shared/dates.js';
import { formatDate, formatMoney, routeKey } from '../../shared/format.js';
import { moveId } from '../../shared/math.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';
import { paintCardColorBand } from '../../domain/card-color.js';
import { loanCount, personCardIds } from '../../domain/person-cards.js';
import { balancesAfterPayments, creditDay, inferClientPrincipal, paymentHistory, ratingSystemActive } from '../../domain/loan-schedule.js';

/** Tarjeta con «Más información» abierta (`modo:id`). Solo una a la vez. */
let openRouteInfo = null;
/** Filtro de la biblioteca por calificación: all | good | irregular | bad. */
let routeLibraryFilter = 'all';

const RATING_TYPE = { good: 'Bueno', irregular: 'Regular', bad: 'Malo' };
/** Miles con signo, como el sistema anterior: 200.000 → «+200», −100.000 → «−100». */
const signedThousands = amount => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${(Math.abs(amount) / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}`;
/** Fecha corta del historial: «23-oct-26». */
const historyDate = iso => {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  if (!year) return '—';
  const name = new Date(year, month - 1, day).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
  return `${String(day).padStart(2, '0')}-${name}-${String(year).slice(-2)}`;
};

/**
 * Número de préstamo de esta cartulina y cuánto subió o bajó el crédito frente al anterior
 * de la misma persona (capital prestado). null en el primer préstamo.
 */
function loanStep(clientId) {
  const client = clients[clientId];
  const ids = personCardIds(clients, client.id);
  const position = Math.max(0, ids.indexOf(clientId));
  const previous = position > 0 ? clients[ids[position - 1]] : null;
  return { number: loanCount(clients, client.id).total, change: previous ? inferClientPrincipal(client) - inferClientPrincipal(previous) : null };
}

/** Información de la cartulina, para desplegar debajo de la tarjeta (lo que pide la oficina). */
function routeCardInfo(clientId) {
  const client = clients[clientId];
  const payments = (client.payments || []).filter(payment => Number(payment.amount) > 0);
  const totalDays = Number(client.totalDays) || 0;
  let dueDate = '';
  if (client.creditStartDate && totalDays) {
    const due = localDate(client.creditStartDate);
    due.setDate(due.getDate() + totalDays);
    dueDate = localDateISO(due);
  }
  // Días atrasados como el sistema anterior: negativo = días que faltan para vencer.
  const lateDays = totalDays ? creditDay(client) - totalDays : null;
  const rows = [
    ['Valor del crédito', formatMoney(client.total)],
    ['Saldo actual', formatMoney(client.balance)],
    ['Plazo', totalDays ? `${totalDays} días` : client.term],
    ['V. Cuota', formatMoney(client.installment)],
    ['F. Crédito', client.creditStartDate ? formatDate(client.creditStartDate) : ''],
    ['F. Vence', dueDate ? formatDate(dueDate) : ''],
    ['Días atrasados', lateDays === null ? '' : String(lateDays)],
    ['Tipo', RATING_TYPE[paymentHistory(client).level]],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
  const list = document.createElement('dl');
  list.className = 'route-card-info';
  rows.forEach(([label, value]) => {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    if (label === 'Días atrasados') detail.classList.toggle('is-late', lateDays > 0);
    item.append(term, detail);
    list.append(item);
  });
  // Historial de abonos: fecha y abono a la izquierda, saldo que dejó a la derecha.
  const history = document.createElement('details');
  history.className = 'route-card-payments';
  const summary = document.createElement('summary');
  const title = document.createElement('span');
  title.textContent = `Historial de abonos (${payments.length})`;
  const step = loanStep(clientId);
  const loan = document.createElement('span');
  loan.className = 'route-loan-step';
  loan.textContent = `Préstamo #${step.number}`;
  if (step.change !== null) {
    const change = document.createElement('b');
    change.className = step.change > 0 ? 'is-up' : step.change < 0 ? 'is-down' : '';
    change.textContent = `${step.change > 0 ? '↑' : step.change < 0 ? '↓' : '='} ${signedThousands(step.change) || '0'}`;
    change.title = step.change ? `Se le prestó ${formatMoney(Math.abs(step.change))} ${step.change > 0 ? 'más' : 'menos'} que en el crédito anterior` : 'Mismo valor que el crédito anterior';
    loan.append(' ', change);
  } else loan.title = 'Primer préstamo de esta persona';
  summary.append(title, loan);
  history.append(summary);
  const balances = balancesAfterPayments(client);
  const ordered = (client.payments || []).map((payment, index) => ({ payment, index, after: balances[index] }))
    .filter(({ payment }) => Number(payment.amount) > 0)
    .sort((a, b) => String(b.payment.date).localeCompare(String(a.payment.date)) || a.index - b.index);
  if (ordered.length) {
    const items = document.createElement('ol');
    items.replaceChildren(...ordered.map(({ payment, after }) => {
      const item = document.createElement('li');
      const date = document.createElement('span');
      date.className = 'route-payment-date';
      date.textContent = historyDate(payment.date);
      const amount = document.createElement('strong');
      amount.className = 'route-payment-amount';
      amount.textContent = formatMoney(payment.amount);
      const balance = document.createElement('span');
      balance.className = 'route-payment-balance';
      balance.textContent = formatMoney(after);
      item.append(date, amount, balance);
      return item;
    }));
    const head = document.createElement('li');
    head.className = 'route-payments-head';
    head.innerHTML = '<span>Fecha</span><span>Abono</span><span>Saldo</span>';
    items.prepend(head);
    history.append(items);
  } else {
    history.append(Object.assign(document.createElement('p'), { textContent: 'Aún no tiene abonos registrados.' }));
  }
  const wrap = document.createElement('div');
  wrap.className = 'route-card-details';
  wrap.append(list, history);
  return wrap;
}

/**
 * Día para el que se arma la ruta: hoy, o el siguiente día de cobro si hoy es domingo o el
 * cobro de hoy ya se verificó y cerró (así se deja lista la ruta de mañana). El domingo no se cobra.
 */
export function routePlanDate(route = state.workerRoute, now = new Date()) {
  const today = localDateISO(now);
  if (now.getDay() !== 0 && routeSettlements[route]?.lastClosure?.date !== today) return today;
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (next.getDay() === 0) next.setDate(next.getDate() + 1);
  return localDateISO(next);
}

/**
 * Momento en que se armó la ruta (se anota al agregar el primer cliente). Las rutas guardadas
 * antes de este cambio tienen solo la fecha: cuentan desde el inicio de ese día.
 */
function routeBuiltTs(route) {
  const stamp = String(state.dailyRouteDates[route] || '');
  if (!stamp) return 0;
  return (stamp.length <= 10 ? Date.parse(`${stamp}T00:00:00`) : Date.parse(stamp)) || 0;
}

/** Cierre («Verificar y cerrar ruta») hecho después de armar la ruta, o null. */
function closureAfterBuild(route) {
  const closure = routeSettlements[route]?.lastClosure;
  const closedTs = closure ? Date.parse(closure.submittedAt) || 0 : 0;
  return closedTs && closedTs > routeBuiltTs(route) ? closure : null;
}

/** ¿El cliente abonó después de armar la ruta? Entonces sale de la lista. */
function paidSinceBuilt(client, builtTs) {
  return (client?.payments || []).some(payment => Number(payment.amount) > 0
    && (payment.at ? Date.parse(payment.at) > builtTs : Date.parse(`${payment.date}T23:59:59`) >= builtTs));
}

/**
 * La ruta armada no se borra sola al cambiar de día: si se armó el lunes y se sale a cobrar el
 * miércoles, sigue igual. Solo cambia cuando:
 *  - el trabajador registra el abono de un cliente de la lista (ese cliente sale), o
 *  - el admin verifica y cierra la ruta (la lista se vacía y se puede armar la siguiente).
 */
function storedRouteOrder(route) {
  const order = state.dailyRouteOrder[route] || [];
  if (!order.length) return order;
  if (!state.dailyRouteDates[route]) state.dailyRouteDates[route] = new Date().toISOString();
  if (closureAfterBuild(route)) {
    state.dailyRouteOrder[route] = [];
    delete state.dailyRouteDates[route];
    return state.dailyRouteOrder[route];
  }
  return order;
}

/** Clientes de la ruta que aún falta cobrar (sin los que ya abonaron desde que se armó). */
export function todayRouteOrder(route = state.workerRoute) {
  const order = storedRouteOrder(route);
  if (!order.length) return order;
  const builtTs = routeBuiltTs(route);
  return order.filter(id => !paidSinceBuilt(clients[id], builtTs));
}

/** ¿Hay una ruta armada y sin cerrar (aunque ya se hayan cobrado todos sus clientes)? */
export function hasBuiltRoute(route = state.workerRoute) {
  return storedRouteOrder(route).length > 0;
}

function setTodayRouteOrder(order, route = state.workerRoute) {
  // La hora de armado se anota solo al empezar una ruta nueva: agregar o mover clientes después
  // no hace volver a la lista a los que ya abonaron.
  if (!storedRouteOrder(route).length || !state.dailyRouteDates[route]) state.dailyRouteDates[route] = new Date().toISOString();
  const paid = (state.dailyRouteOrder[route] || []).filter(id => !order.includes(id) && paidSinceBuilt(clients[id], routeBuiltTs(route)));
  state.dailyRouteOrder[route] = [...order, ...paid];
  if (!state.dailyRouteOrder[route].length) delete state.dailyRouteDates[route];
}

/** Día de la semana y fecha para la que ya se puede armar la ruta: «miércoles 29 de octubre». */
function planDayLabel(route = state.workerRoute) {
  return new Date(`${routePlanDate(route)}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Aviso cuando el admin ya verificó y cerró la ruta: «Ya puede armar su ruta para el …».
 * Vacío si todavía hay una ruta armada sin cerrar o si nunca se ha cerrado.
 */
export function routeReadyMessage(route = state.workerRoute) {
  const closure = routeSettlements[route]?.lastClosure;
  if (!closure || hasBuiltRoute(route)) return '';
  const today = localDateISO();
  const plan = routePlanDate(route);
  const day = planDayLabel(route);
  if (closure.date === today) return `La ruta de hoy ya se verificó y cerró. Ya puede armar su ruta para el ${day}.`;
  return `Ya puede armar su ruta para ${plan === today ? 'hoy, ' : 'el '}${day}.`;
}

/** El trabajador recibe un aviso (una sola vez por cierre) apenas el admin cierra la ruta. */
function announceRouteReady(route = state.workerRoute) {
  const closure = routeSettlements[route]?.lastClosure;
  if (state.userRole !== 'worker' || !closure?.submittedAt || closure.date !== localDateISO()) return;
  const key = `edgecredit-route-ready-${route}`;
  try { if (localStorage.getItem(key) === closure.submittedAt) return; } catch { return; }
  const message = routeReadyMessage(route);
  if (!message) return;
  try { localStorage.setItem(key, closure.submittedAt); } catch { /* opcional */ }
  showToast(message);
}

/** ¿Se está armando la ruta de un día que todavía no llega? */
const planningAhead = (route = state.workerRoute) => routePlanDate(route) > localDateISO();

export function routeDayKey(route = state.workerRoute) {
  const date = localDateISO();
  return `${route}:${date}`;
}

function requestVisitCorrection(clientId, key) {
  const client = clients[clientId];
  const visitDate = key.slice(key.indexOf(':') + 1);
  // Abono registrado ese día (si lo hay): se corrige ese mismo, como en «Abonos del día».
  const payment = (client.payments || []).find(item => item.date === visitDate && Number(item.amount) > 0) || null;
  openCustomModal({
    title: 'Solicitar corrección al administrador',
    description: payment
      ? `Abono de ${client.name} del ${formatDate(visitDate)} por ${formatMoney(payment.amount)}. Indica el monto correcto y qué pasó.`
      : `Visita de ${client.name} del ${formatDate(visitDate)} sin abono registrado. Indica el monto que pagó y qué pasó.`,
    fields: [
      { name: 'amount', label: 'Monto correcto del abono ($)', type: 'number', money: true, thousands: true, min: 1, step: 1, required: true, value: payment?.amount || '' },
      { name: 'comment', label: 'Comentario para el administrador', type: 'textarea', rows: 3, placeholder: 'Describe qué ocurrió y qué corrección se necesita', required: true },
    ],
    submitLabel: 'Enviar solicitud',
    onSubmit: values => {
      pendingRequests.unshift({
        id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'route-correction', routeId: routeKey(client.route), route: client.route,
        workerId: state.activeWorker?.id, workerName: state.activeWorker?.name || 'Trabajador', clientId, clientName: client.name, visitDate,
        paymentAt: payment?.at || '', paymentAmount: Number(payment?.amount) || 0, requestedAmount: Number(values.amount) || 0,
        previousOutcome: state.routeVisitOutcomes[key]?.[clientId] || 'closed', comment: String(values.comment || '').trim(), createdAt: new Date().toISOString(), status: 'pending',
      });
      persistBusinessData();
      renderPendingRequests();
      showToast('Solicitud de corrección enviada al administrador.');
    }
  });
}

/** ¿Ya hay una solicitud de corrección pendiente para este abono? */
export function paymentCorrectionPending(clientId, payment) {
  return pendingRequests.some(request => request.status === 'pending' && request.type === 'route-correction' && request.clientId === clientId
    && (payment.at ? request.paymentAt === payment.at : request.visitDate === payment.date));
}

/**
 * Corrección de un abono puntual (desde «Abonos del día»): el trabajador indica el monto
 * correcto y el motivo; el admin lo aprueba en Solicitudes y se corrige ese abono.
 */
export function requestPaymentCorrection(clientId, payment, onSent = () => {}) {
  const client = clients[clientId];
  if (!client || !payment) return;
  if (paymentCorrectionPending(clientId, payment)) { showToast('Ya enviaste una corrección de este abono: espera al administrador.'); return; }
  openCustomModal({
    title: 'Solicitar corrección al administrador',
    description: `Abono de ${client.name} del ${formatDate(payment.date)} por ${formatMoney(payment.amount)}. Indica el monto correcto y qué pasó.`,
    fields: [
      { name: 'amount', label: 'Monto correcto del abono ($)', type: 'number', money: true, thousands: true, min: 1, step: 1, required: true, value: payment.amount },
      { name: 'comment', label: 'Comentario para el administrador', type: 'textarea', rows: 3, required: true, placeholder: 'Ej. Pagó $ 30.000, se registró $ 300.000 por error' },
    ],
    submitLabel: 'Enviar solicitud',
    onSubmit: values => {
      pendingRequests.unshift({
        id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'route-correction', routeId: routeKey(client.route), route: client.route,
        workerId: state.activeWorker?.id, workerName: state.activeWorker?.name || 'Trabajador', clientId, clientName: client.name,
        visitDate: payment.date, paymentAt: payment.at || '', paymentAmount: Number(payment.amount) || 0, requestedAmount: Number(values.amount) || 0,
        previousOutcome: 'paid', comment: String(values.comment || '').trim(), createdAt: new Date().toISOString(), status: 'pending',
      });
      persistBusinessData();
      renderPendingRequests();
      onSent();
      showToast('Solicitud de corrección enviada al administrador.');
    },
  });
}

/** Abonos registrados hoy para el cliente (solo cuentan los del día, no los del ciclo). */
export function paidTodayAmount(client) {
  const today = localDateISO();
  return (client?.payments || []).filter(payment => payment.date === today).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

/** Estado de la visita de hoy: 'paid' (abonó hoy), 'no-payment' (no pagó) o 'pending'. */
export function visitStatus(clientId) {
  const client = clients[clientId];
  if (paidTodayAmount(client) > 0) return 'paid';
  return state.routeVisitOutcomes[routeDayKey()]?.[clientId] === 'no-payment' ? 'no-payment' : 'pending';
}

/** Cierra la visita de hoy: el cliente sale de la lista del Inicio pero sigue en la ruta diaria. */
export function closeVisit(clientId, outcome, route = state.workerRoute) {
  const key = routeDayKey(route);
  state.collectedRouteClients[key] ||= [];
  if (!state.collectedRouteClients[key].includes(clientId)) state.collectedRouteClients[key].push(clientId);
  state.routeVisitOutcomes[key] ||= {};
  if (outcome) state.routeVisitOutcomes[key][clientId] = outcome;
}

/** Registra "No pagó hoy" y cierra la visita. */
export function markNoPayment(clientId) {
  const client = clients[clientId];
  if (!client) return;
  if (paidTodayAmount(client) > 0) { showToast('Este cliente ya tiene un abono hoy; no se puede marcar como “No pagó”.'); return; }
  const today = localDateISO();
  closeVisit(clientId, 'no-payment');
  // Con la calificación por puntos el «No pagó hoy» solo cierra la visita; la demora la mide el calendario.
  if (!ratingSystemActive(today)) client.paymentWarning = true;
  client.visitHistory = (client.visitHistory || []).filter(item => item.date !== today);
  client.visitHistory.push({ date: today, outcome: 'no-payment' });
  persistBusinessData(); renderRouteBuilder(); filterClientCards(); renderClientRows(clientId);
  showToast(`Se registró que ${client.name} no pagó hoy.`);
}

function statusChip(status, client) {
  const chip = document.createElement('span');
  chip.className = `route-status-chip is-${status}`;
  chip.setAttribute('role', 'status');
  chip.textContent = status === 'paid' ? `✓ Abono registrado · ${formatMoney(paidTodayAmount(client))}` : status === 'no-payment' ? '✕ No pagó hoy' : 'Pendiente';
  return chip;
}

function routeClientCard(clientId, mode, routeOrder = []) {
  const client = clients[clientId];
  const isDaily = mode === 'daily';
  // En la ruta armada para mañana todavía no hay visitas: todo queda pendiente.
  const status = planningAhead() ? 'pending' : visitStatus(clientId);
  const card = document.createElement('article');
  card.className = 'route-sort-item';
  card.classList.toggle('is-visited', isDaily && status !== 'pending');
  card.draggable = true;
  card.dataset.routeClient = clientId;
  card.dataset.routeMode = mode;
  const handle = document.createElement('span');
  handle.className = 'route-drag-handle';
  handle.textContent = '⠿';
  handle.setAttribute('aria-hidden', 'true');
  const name = document.createElement('strong');
  name.textContent = client.name;
  const sub = document.createElement('small');
  sub.textContent = `${client.id} · ${formatMoney(client.installment)} por cuota`;
  const content = document.createElement('span');
  content.className = 'route-sort-copy';
  content.append(name, sub);
  const actions = document.createElement('div');
  actions.className = 'route-card-actions';
  if (isDaily) {
    // En la ruta diaria solo hay indicadores; los abonos se registran desde el Inicio.
    actions.append(statusChip(status, client));
    if (status !== 'pending' && state.userRole === 'worker') {
      const correction = document.createElement('button');
      correction.type = 'button'; correction.className = 'route-reopen-button'; correction.dataset.routeCorrection = clientId; correction.textContent = 'Solicitar corrección';
      actions.append(correction);
    }
  } else if (routeOrder.includes(clientId)) {
    const inRoute = document.createElement('span');
    inRoute.className = 'route-status-chip is-in-route';
    inRoute.textContent = 'En la ruta de hoy';
    actions.append(inRoute);
  } else {
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'route-add-button'; add.dataset.routeAdd = clientId; add.textContent = '＋ Agregar';
    actions.append(add);
  }
  // Más información: despliega la cartulina completa debajo (solo una abierta a la vez).
  const infoKey = `${mode}:${clientId}`;
  const open = openRouteInfo === infoKey;
  const info = document.createElement('button');
  info.type = 'button'; info.className = 'route-info-button'; info.dataset.routeInfo = infoKey;
  info.setAttribute('aria-expanded', String(open));
  info.textContent = open ? 'Menos información ▴' : 'Más información ▾';
  actions.append(info);
  const band = document.createElement('span');
  band.className = 'card-color-band';
  paintCardColorBand(band, client, card);
  card.append(band, handle, clientAvatarWithProgress(client, { small: true }), content, actions);
  if (open) card.append(routeCardInfo(clientId));
  return card;
}

/** Cartulinas activas: las pagadas al 100 % no aparecen en la biblioteca de la ruta. */
const isActiveCredit = client => Number(client.balance) > 0;

export function renderRouteBuilder() {
  const library = document.querySelector('#route-library-list');
  const daily = document.querySelector('#route-daily-list');
  if (!library || !daily) return;
  const routeIds = Object.keys(clients).filter(id => clients[id].route === state.workerRoute);
  const savedLibrary = state.clientLibraryOrder[state.workerRoute] || [];
  const libraryOrder = [...savedLibrary.filter(id => routeIds.includes(id)), ...routeIds.filter(id => !savedLibrary.includes(id))].filter(id => isActiveCredit(clients[id]));
  // La lista del día se conserva tal como se armó, aunque los clientes ya hayan sido visitados.
  const dailyOrder = todayRouteOrder().filter(id => routeIds.includes(id));
  const query = document.querySelector('#route-library-search').value.trim().toLocaleLowerCase('es');
  const matchesQuery = id => !query || `${clients[id].name} ${clients[id].id}`.toLocaleLowerCase('es').includes(query);
  const levels = Object.fromEntries(libraryOrder.map(id => [id, paymentHistory(clients[id]).level]));
  const counts = { all: 0, good: 0, irregular: 0, bad: 0 };
  libraryOrder.filter(matchesQuery).forEach(id => { counts.all += 1; counts[levels[id]] += 1; });
  Object.entries(counts).forEach(([key, value]) => { const node = document.querySelector(`[data-route-filter-count="${key}"]`); if (node) node.textContent = String(value); });
  const visibleLibrary = libraryOrder.filter(id => matchesQuery(id) && (routeLibraryFilter === 'all' || levels[id] === routeLibraryFilter));
  library.replaceChildren(...visibleLibrary.map(id => routeClientCard(id, 'library', dailyOrder)));
  daily.replaceChildren(...dailyOrder.map(id => routeClientCard(id, 'daily', dailyOrder)));
  if (!library.children.length) library.append(Object.assign(document.createElement('p'), { className: 'route-empty', textContent: query || routeLibraryFilter !== 'all' ? 'No se encontraron clientes.' : 'No hay cartulinas activas en esta ruta.' }));
  if (!daily.children.length) daily.append(Object.assign(document.createElement('p'), { className: 'route-empty', textContent: 'Agrega clientes desde la biblioteca para armar la ruta.' }));
  // Título según el día que se está armando: hoy o el siguiente día de cobro.
  const ahead = planningAhead();
  const planDay = planDayLabel();
  document.querySelector('#route-daily-title').textContent = ahead ? `Ruta del ${planDay}` : 'Clientes de hoy';
  const note = document.querySelector('#route-plan-note');
  const ready = routeReadyMessage();
  const message = ready || (ahead ? `${new Date().getDay() === 0 ? 'Hoy es domingo' : 'La ruta de hoy ya se cerró'}: la ruta que armes queda lista para el ${planDay}.` : '');
  note.hidden = !message;
  note.textContent = message ? `${message} La lista no se borra al cambiar de día: solo salen los clientes a los que registres el abono, y se vacía cuando el administrador verifique y cierre la ruta.` : '';
  announceRouteReady();
}

function commitRouteDrop(id, sourceMode, targetMode, beforeId) {
  if (targetMode === 'daily') {
    const order = [...todayRouteOrder()];
    if (!order.includes(id)) order.push(id);
    setTodayRouteOrder(moveId(order, id, beforeId));
  } else {
    if (sourceMode === 'daily') setTodayRouteOrder(todayRouteOrder().filter(item => item !== id));
    const order = [...(state.clientLibraryOrder[state.workerRoute] || Object.keys(clients).filter(key => clients[key].route === state.workerRoute))];
    state.clientLibraryOrder[state.workerRoute] = moveId(order, id, beforeId);
  }
  persistBusinessData();
  renderRouteBuilder();
  filterClientCards();
}

function updateDailyRouteDrop(container, mode) {
  container.addEventListener('dragstart', event => {
    const card = event.target.closest('[data-route-client]');
    if (!card) return;
    state.draggedRouteClient = { id: card.dataset.routeClient, mode: card.dataset.routeMode };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', state.draggedRouteClient.id);
    card.classList.add('is-dragging');
  });
  container.addEventListener('dragend', event => event.target.closest('[data-route-client]')?.classList.remove('is-dragging'));
  container.addEventListener('dragover', event => { if (state.draggedRouteClient) { event.preventDefault(); container.classList.add('is-drop-target'); } });
  container.addEventListener('dragleave', event => { if (!container.contains(event.relatedTarget)) container.classList.remove('is-drop-target'); });
  container.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    const handle = event.target.closest('.route-drag-handle');
    const card = handle?.closest('[data-route-client]');
    if (!card) return;
    event.preventDefault();
    state.routePointerDrag = { id: card.dataset.routeClient, mode: card.dataset.routeMode, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });
  container.addEventListener('drop', event => {
    if (!state.draggedRouteClient) return;
    event.preventDefault();
    container.classList.remove('is-drop-target');
    const target = event.target.closest('[data-route-client]');
    const beforeId = target?.dataset.routeClient === state.draggedRouteClient.id ? null : target?.dataset.routeClient;
    const { id, mode: sourceMode } = state.draggedRouteClient;
    state.draggedRouteClient = null;
    commitRouteDrop(id, sourceMode, mode, beforeId);
  });
  container.addEventListener('click', event => {
    const addButton = event.target.closest('[data-route-add]');
    if (addButton) {
      const order = [...todayRouteOrder()];
      if (!order.includes(addButton.dataset.routeAdd)) order.push(addButton.dataset.routeAdd);
      setTodayRouteOrder(order);
      persistBusinessData(); renderRouteBuilder(); filterClientCards();
      return;
    }
    const infoButton = event.target.closest('[data-route-info]');
    if (infoButton) {
      openRouteInfo = openRouteInfo === infoButton.dataset.routeInfo ? null : infoButton.dataset.routeInfo;
      renderRouteBuilder();
      return;
    }
    const correctionButton = event.target.closest('[data-route-correction]');
    if (correctionButton) requestVisitCorrection(correctionButton.dataset.routeCorrection, routeDayKey());
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  window.addEventListener('pointermove', event => {
    if (!state.routePointerDrag || event.pointerId !== state.routePointerDrag.pointerId) return;
    if (!state.routePointerDrag.moved && Math.hypot(event.clientX - state.routePointerDrag.x, event.clientY - state.routePointerDrag.y) > 8) state.routePointerDrag.moved = true;
    if (!state.routePointerDrag.moved) return;
    document.querySelectorAll('#route-library-list,#route-daily-list').forEach(list => list.classList.remove('is-drop-target'));
    const targetList = document.elementFromPoint(event.clientX, event.clientY)?.closest('#route-library-list,#route-daily-list');
    targetList?.classList.add('is-drop-target');
    document.querySelectorAll('.route-sort-item.is-drop-target').forEach(card => card.classList.remove('is-drop-target'));
    document.elementFromPoint(event.clientX, event.clientY)?.closest('.route-sort-item')?.classList.add('is-drop-target');
  });
  window.addEventListener('pointerup', event => {
    if (!state.routePointerDrag || event.pointerId !== state.routePointerDrag.pointerId) return;
    const drag = state.routePointerDrag;
    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const targetList = targetElement?.closest('#route-library-list,#route-daily-list');
    const targetCard = targetElement?.closest('[data-route-client]');
    state.routePointerDrag = null;
    document.querySelectorAll('.route-drag-list.is-drop-target,.route-sort-item.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
    if (!drag.moved || !targetList) return;
    const destination = targetList.id === 'route-daily-list' ? 'daily' : 'library';
    if (targetCard?.dataset.routeClient === drag.id && destination === drag.mode) return;
    commitRouteDrop(drag.id, drag.mode, destination, targetCard?.dataset.routeClient === drag.id ? null : targetCard?.dataset.routeClient);
  });
  document.querySelectorAll('#route-library-list,#route-daily-list').forEach((container, index) => updateDailyRouteDrop(container, index === 0 ? 'library' : 'daily'));
  document.querySelector('#route-library-search')?.addEventListener('input', renderRouteBuilder);
  document.querySelector('#route-library-filters')?.addEventListener('click', event => {
    const chip = event.target.closest('[data-route-filter]');
    if (!chip) return;
    routeLibraryFilter = chip.dataset.routeFilter;
    document.querySelectorAll('[data-route-filter]').forEach(button => {
      const active = button === chip;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-checked', String(active));
    });
    renderRouteBuilder();
  });
}
