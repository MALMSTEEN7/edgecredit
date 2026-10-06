/**
 * features/daily-route · Constructor de la ruta diaria: biblioteca (solo cartulinas activas),
 * orden de visitas e indicadores del día. Las visitas se cierran solas al registrar un abono
 * o "No pagó hoy" desde el Inicio; aquí solo se ven los indicadores y se pide revisión.
 */

import { state } from '../../core/state.js';
import { clients, pendingRequests, persistBusinessData } from '../../core/store.js';
import { renderPendingRequests } from '../admin/pending.js';
import { filterClientCards, renderClientRows } from '../clients/directory.js';
import { localDateISO } from '../../shared/dates.js';
import { formatDate, formatMoney, routeKey } from '../../shared/format.js';
import { moveId } from '../../shared/math.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';

export function routeDayKey(route = state.workerRoute) {
  const date = localDateISO();
  return `${route}:${date}`;
}

function requestVisitCorrection(clientId, key) {
  const client = clients[clientId];
  const visitDate = key.slice(key.indexOf(':') + 1);
  openCustomModal({
    title: 'Solicitar revisión al administrador',
    description: `Explica por qué debe corregirse la visita o el pago de ${client.name} del ${formatDate(visitDate)}.`,
    fields: [{ name: 'comment', label: 'Comentario para el administrador', type: 'textarea', rows: 4, placeholder: 'Describe qué ocurrió y qué corrección se necesita', required: true }],
    submitLabel: 'Enviar solicitud',
    onSubmit: values => {
      pendingRequests.unshift({ id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'route-correction', routeId: routeKey(client.route), route: client.route, workerId: state.activeWorker?.id, workerName: state.activeWorker?.name || 'Trabajador', clientId, clientName: client.name, visitDate, previousOutcome: state.routeVisitOutcomes[key]?.[clientId] || 'closed', comment: values.comment.trim(), createdAt: new Date().toISOString(), status: 'pending' });
      persistBusinessData();
      renderPendingRequests();
      showToast('Solicitud enviada al administrador para revisión.');
    }
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
  client.paymentWarning = true;
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
  const status = visitStatus(clientId);
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
      correction.type = 'button'; correction.className = 'route-reopen-button'; correction.dataset.routeCorrection = clientId; correction.textContent = 'Solicitar revisión';
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
  card.append(handle, content, actions);
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
  const dailyOrder = (state.dailyRouteOrder[state.workerRoute] || []).filter(id => routeIds.includes(id));
  const query = document.querySelector('#route-library-search').value.trim().toLocaleLowerCase('es');
  const visibleLibrary = libraryOrder.filter(id => !query || `${clients[id].name} ${clients[id].id}`.toLocaleLowerCase('es').includes(query));
  library.replaceChildren(...visibleLibrary.map(id => routeClientCard(id, 'library', dailyOrder)));
  daily.replaceChildren(...dailyOrder.map(id => routeClientCard(id, 'daily', dailyOrder)));
  if (!library.children.length) library.append(Object.assign(document.createElement('p'), { className: 'route-empty', textContent: query ? 'No se encontraron clientes.' : 'No hay cartulinas activas en esta ruta.' }));
  if (!daily.children.length) daily.append(Object.assign(document.createElement('p'), { className: 'route-empty', textContent: 'Agrega clientes desde la biblioteca para armar la ruta.' }));
}

function commitRouteDrop(id, sourceMode, targetMode, beforeId) {
  if (targetMode === 'daily') {
    const order = [...(state.dailyRouteOrder[state.workerRoute] || [])];
    if (!order.includes(id)) order.push(id);
    state.dailyRouteOrder[state.workerRoute] = moveId(order, id, beforeId);
  } else {
    if (sourceMode === 'daily') state.dailyRouteOrder[state.workerRoute] = (state.dailyRouteOrder[state.workerRoute] || []).filter(item => item !== id);
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
      const order = [...(state.dailyRouteOrder[state.workerRoute] || [])];
      if (!order.includes(addButton.dataset.routeAdd)) order.push(addButton.dataset.routeAdd);
      state.dailyRouteOrder[state.workerRoute] = order;
      persistBusinessData(); renderRouteBuilder(); filterClientCards();
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
}
