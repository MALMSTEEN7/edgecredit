/**
 * features/clients/directory · Tarjetas de clientes, filtro por ruta/búsqueda
 * y reordenamiento del directorio (drag & drop y táctil).
 */

import { paymentFrequencyLabels } from '../../core/config.js';
import { clientButtons, directoryClientList, routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData, routeSettlements } from '../../core/store.js';
import { paymentBehavior, paymentHistory } from '../../domain/loan-schedule.js';
import { openClient } from './client-detail.js';
import { visitStatus } from '../daily-route/daily-route.js';
import { formatMoney } from '../../shared/format.js';
import { moveId } from '../../shared/math.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showView } from '../../ui/navigation.js';
import { renderHomeHeader, renderHomeRowActions } from '../worker/home.js';
import { personCardIds } from '../../domain/person-cards.js';
import { paintCardColorBand } from '../../domain/card-color.js';

/**
 * Agrega las filas del cliente en el Inicio y el directorio. Al cargar muchos clientes de una vez
 * se pasa `{ refresh: false }` y se filtra una sola vez al final (filtrar por cada uno es muy lento).
 */
export function appendClientCards(clientId, { refresh = true } = {}) {
  const client = clients[clientId];
  document.querySelectorAll('#inicio .client-list, #directorio .client-list').forEach(list => {
    const isHome = Boolean(list.closest('#inicio'));
    // En el Inicio la fila es un contenedor (lleva botones de acción); en el directorio, un botón.
    const card = document.createElement(isHome ? 'div' : 'button');
    if (!isHome) card.type = 'button';
    card.className = isHome ? 'client-row home-client-row' : 'client-row';
    card.dataset.client = clientId;
    card.dataset.route = client.route;
    const avatar = document.createElement('span');
    avatar.className = 'client-avatar avatar-blue';
    setClientAvatar(avatar, client);
    const main = document.createElement('span');
    main.className = 'client-main';
    const name = document.createElement('strong');
    name.textContent = client.name;
    const detail = document.createElement('span');
    detail.textContent = `Préstamo activo · Cuota ${formatMoney(client.installment)} · ${paymentFrequencyLabels[client.frequency] || 'Semanal'}`;
    main.append(name, detail);
    const arrow = document.createElement(isHome ? 'button' : 'span');
    arrow.className = isHome ? 'row-chevron home-row-open' : 'row-chevron';
    arrow.textContent = '›';
    if (isHome) { arrow.type = 'button'; arrow.setAttribute('aria-label', `Ver ficha de ${client.name}`); card.append(avatar, main, arrow); }
    else {
      const dragHandle = document.createElement('span');
      dragHandle.className = 'directory-drag-handle';
      dragHandle.textContent = '⠿';
      dragHandle.setAttribute('aria-hidden', 'true');
      card.append(avatar, main, dragHandle, arrow);
    }
    card.addEventListener('click', event => { if (!event.target.closest('[data-home-action]')) openClient(clientId); });
    list.append(card);
  });
  renderClientRows(clientId);
  if (refresh) filterClientCards();
}

export function setClientAvatar(element, client) {
  element.replaceChildren();
  if (client.photoData) {
    const image = document.createElement('img');
    image.src = client.photoData;
    image.alt = `Foto de ${client.name}`;
    element.classList.add('has-photo');
    element.append(image);
  } else {
    element.classList.remove('has-photo');
    element.textContent = client.initials || client.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
}

export function renderClientRows(clientId) {
  const client = clients[clientId];
  document.querySelectorAll(`.client-row[data-client="${clientId}"] .client-main strong`).forEach(node => { node.textContent = client.name; });
  document.querySelectorAll(`.client-row[data-client="${clientId}"] .client-avatar`).forEach(node => setClientAvatar(node, client));
  document.querySelectorAll(`.client-row[data-client="${clientId}"]`).forEach(row => {
    row.dataset.route = client.route;
    // Franja de color en el borde superior (día de pago / quincenal / mensual).
    let band = row.querySelector(':scope > .card-color-band');
    if (!band) { band = document.createElement('span'); band.className = 'card-color-band'; row.prepend(band); }
    paintCardColorBand(band, client, row);
    const main = row.querySelector('.client-main');
    const description = main?.querySelector(':scope > span:not(.client-risk-line)');
    // Si la persona tiene varias cartulinas, cada fila indica cuál es.
    const siblings = personCardIds(clients, client.id);
    const cardTag = siblings.length > 1 ? ` · Cartulina ${siblings.indexOf(clientId) + 1}` : '';
    if (description) description.textContent = `Préstamo activo${cardTag} · Cuota ${formatMoney(client.installment)} · ${paymentFrequencyLabels[client.frequency] || 'Semanal'}`;
    if (main && !main.querySelector('.client-risk-line')) {
      const riskLine = document.createElement('span');
      riskLine.className = 'client-risk-line';
      riskLine.innerHTML = '<i class="behavior-dot" aria-hidden="true"></i><span></span>';
      main.append(riskLine);
    }
    const risk = paymentBehavior(client);
    const riskLine = main?.querySelector('.client-risk-line');
    if (riskLine) {
      riskLine.style.setProperty('--behavior-color', risk.color);
      riskLine.querySelector('span').textContent = risk.label;
      riskLine.dataset.tier = risk.tier;
      riskLine.title = risk.overduePeriods > 0 ? `Cuotas vencidas sin pagar según la frecuencia ${paymentFrequencyLabels[client.frequency]?.toLocaleLowerCase('es') || 'semanal'}.` : 'Sin cuotas vencidas pendientes.';
    }
    const status = row.querySelector('.status');
    const late = risk.overduePeriods > 0 || client.late;
    if (status) { status.textContent = late ? 'Mora' : 'Al día'; status.classList.toggle('status-late', late); status.classList.toggle('status-current', !late); }
  });
}

export function removeClient(clientId) {
  if (state.userRole !== 'admin' || !clients[clientId]) return;
  openCustomModal({
    title: 'Eliminar cliente', description: `Se quitará a ${clients[clientId].name} del directorio de demostración.`, submitLabel: 'Eliminar',
    onSubmit: () => {
      delete clients[clientId];
      persistBusinessData();
      document.querySelectorAll(`.client-row[data-client="${clientId}"]`).forEach(node => { node.hidden = true; });
      showView('directorio');
    }
  });
}

/**
 * Filtro del directorio: activas (con saldo), buenos / regulares / malos (según el
 * historial de pagos de las cartulinas activas) y canceladas (saldo en cero).
 */
let directoryFilter = 'active';

function directoryCategory(client) {
  if (Number(client.balance) <= 0) return 'cancelled';
  return paymentHistory(client).level; // good | irregular | bad
}

function matchesDirectoryFilter(client) {
  const category = directoryCategory(client);
  if (directoryFilter === 'active') return category !== 'cancelled';
  return category === directoryFilter;
}

function renderDirectoryFilterCounts(route) {
  const counts = { active: 0, good: 0, irregular: 0, bad: 0, cancelled: 0 };
  Object.values(clients).forEach(client => {
    if (!client || client.route !== route) return;
    const category = directoryCategory(client);
    counts[category] += 1;
    if (category !== 'cancelled') counts.active += 1;
  });
  Object.entries(counts).forEach(([key, value]) => {
    const node = document.querySelector(`[data-filter-count="${key}"]`);
    if (node) node.textContent = String(value);
  });
}

export function filterClientCards() {
  const route = state.userRole === 'admin' ? routeSelect.value : state.workerRoute;
  const query = document.querySelector('#directory-search')?.value.trim().toLocaleLowerCase('es') || '';
  const todayOrder = state.dailyRouteOrder[route] || [];
  document.querySelectorAll('#worker-view [data-client][data-route]').forEach(card => {
    const matchesRoute = card.dataset.route === route;
    const matchesQuery = card.textContent.toLocaleLowerCase('es').includes(query);
    const exists = Object.prototype.hasOwnProperty.call(clients, card.dataset.client);
    // Inicio: solo cartulinas activas de la ruta del día que aún no se visitaron hoy
    // (al registrar un abono o "No pagó hoy" la fila desaparece del Inicio).
    const homeClient = clients[card.dataset.client];
    const dailySelected = !card.closest('#inicio .client-list') || (exists && Number(homeClient.balance) > 0 && visitStatus(card.dataset.client) === 'pending' && (!todayOrder.length || todayOrder.includes(card.dataset.client)));
    const inDirectory = Boolean(card.closest('#directorio'));
    const passesFilter = !inDirectory || (exists && matchesDirectoryFilter(homeClient));
    card.hidden = !exists || !matchesRoute || !matchesQuery || !dailySelected || !passesFilter;
  });
  if (state.userRole === 'worker' && todayOrder.length) {
    const homeList = document.querySelector('#inicio .client-list');
    [...homeList.querySelectorAll('.client-row')].sort((a, b) => todayOrder.indexOf(a.dataset.client) - todayOrder.indexOf(b.dataset.client)).forEach(row => homeList.append(row));
  }
  renderDirectoryFilterCounts(route);
  const anyVisible = [...document.querySelectorAll('#directorio .client-row')].some(row => !row.hidden);
  document.querySelector('#directory-empty').hidden = anyVisible;
  const directoryTitle = document.querySelector('#directory-title');
  if (state.userRole === 'admin') directoryTitle.textContent = `Directorio · Ruta ${routeSettlements[route].name}`;
  else directoryTitle.textContent = 'Directorio';
  if (state.userRole === 'worker') {
    const order = state.clientLibraryOrder[route] || [];
    document.querySelectorAll('#directorio .client-list').forEach(list => {
      const rows = [...list.querySelectorAll('.client-row')];
      rows.forEach(row => {
        row.draggable = true;
        if (!row.querySelector('.directory-drag-handle')) {
          const handle = document.createElement('span');
          handle.className = 'directory-drag-handle'; handle.textContent = '⠿'; handle.setAttribute('aria-hidden', 'true');
          row.prepend(handle);
        }
        else row.prepend(row.querySelector('.directory-drag-handle'));
      });
      rows.sort((a, b) => {
        const ai = order.indexOf(a.dataset.client), bi = order.indexOf(b.dataset.client);
        return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
      }).forEach(row => list.append(row));
    });
  } else document.querySelectorAll('#directorio .client-row').forEach(row => { row.draggable = false; row.querySelector('.directory-drag-handle')?.remove(); });
  if (state.userRole === 'worker') { renderHomeHeader(); renderHomeRowActions(); }
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#directory-filters').addEventListener('click', event => {
    const chip = event.target.closest('[data-directory-filter]');
    if (!chip) return;
    directoryFilter = chip.dataset.directoryFilter;
    document.querySelectorAll('[data-directory-filter]').forEach(button => {
      const active = button === chip;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-checked', String(active));
    });
    filterClientCards();
  });
  directoryClientList.addEventListener('dragstart', event => {
    const card = event.target.closest('.client-row[draggable="true"]');
    if (!card || state.userRole !== 'worker') return;
    state.draggedRouteClient = { id: card.dataset.client, mode: 'directory' };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', state.draggedRouteClient.id);
    card.classList.add('is-dragging');
  });
  directoryClientList.addEventListener('dragend', event => event.target.closest('.client-row')?.classList.remove('is-dragging'));
  directoryClientList.addEventListener('dragover', event => { if (state.draggedRouteClient?.mode === 'directory') event.preventDefault(); });
  directoryClientList.addEventListener('drop', event => {
    if (state.draggedRouteClient?.mode !== 'directory') return;
    event.preventDefault();
    const target = event.target.closest('.client-row');
    const id = state.draggedRouteClient.id;
    const order = [...directoryClientList.querySelectorAll('.client-row')].filter(row => row.dataset.route === state.workerRoute).map(row => row.dataset.client);
    state.clientLibraryOrder[state.workerRoute] = moveId(order, id, target?.dataset.client === id ? null : target?.dataset.client);
    state.draggedRouteClient = null;
    persistBusinessData();
    filterClientCards();
  });
  directoryClientList.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    const handle = event.target.closest('.directory-drag-handle');
    const card = handle?.closest('.client-row');
    if (!card || state.userRole !== 'worker') return;
    event.preventDefault();
    state.directoryPointerDrag = { id: card.dataset.client, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    card.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', event => {
    if (!state.directoryPointerDrag || event.pointerId !== state.directoryPointerDrag.pointerId) return;
    if (!state.directoryPointerDrag.moved && Math.hypot(event.clientX - state.directoryPointerDrag.startX, event.clientY - state.directoryPointerDrag.startY) > 8) state.directoryPointerDrag.moved = true;
    if (!state.directoryPointerDrag.moved) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('#directorio .client-row');
    directoryClientList.querySelectorAll('.is-drop-target').forEach(row => row.classList.remove('is-drop-target'));
    target?.classList.add('is-drop-target');
  });
  window.addEventListener('pointerup', event => {
    if (!state.directoryPointerDrag || event.pointerId !== state.directoryPointerDrag.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('#directorio .client-row');
    const id = state.directoryPointerDrag.id;
    const order = [...directoryClientList.querySelectorAll('.client-row')].filter(row => row.dataset.route === state.workerRoute).map(row => row.dataset.client);
    if (state.directoryPointerDrag.moved && target && target.dataset.client !== id) state.clientLibraryOrder[state.workerRoute] = moveId(order, id, target.dataset.client);
    state.directoryPointerDrag = null;
    directoryClientList.querySelectorAll('.is-dragging,.is-drop-target').forEach(row => row.classList.remove('is-dragging', 'is-drop-target'));
    persistBusinessData(); filterClientCards();
  });
  clientButtons.forEach(button => button.addEventListener('click', event => { if (!event.target.closest('[data-home-action]')) openClient(button.dataset.client); }));
  document.querySelector('#directory-search')?.addEventListener('input', filterClientCards);
}
