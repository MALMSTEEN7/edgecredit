/**
 * features/worker/home · Inicio del trabajador: primero los clientes de la ruta del día;
 * "Tu base hoy" y "Resumen del día" quedan plegados detrás de dos botones.
 */

import { state } from '../../core/state.js';
import { openClient } from '../clients/client-detail.js';
import { hasBuiltRoute, markNoPayment, moveInRoute, renderRouteBuilder, routeReadyMessage } from '../daily-route/daily-route.js';
import { openPayment } from '../payments/payment.js';
import { clients, persistBusinessData, routeSettlements } from '../../core/store.js';
import { filterClientCards } from '../clients/directory.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showView } from '../../ui/navigation.js';

const PANELS = [['#toggle-home-cash', '#home-cash-panel'], ['#toggle-home-metrics', '#home-metrics-panel']];

function setPanel(toggleSelector, panelSelector, open) {
  const toggle = document.querySelector(toggleSelector);
  const panel = document.querySelector(panelSelector);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.classList.toggle('is-open', open);
  panel.hidden = !open;
}

/** Cierra los paneles (al iniciar sesión cada jornada empieza con la vista de clientes). */
export function collapseHomePanels() {
  PANELS.forEach(([toggle, panel]) => setPanel(toggle, panel, false));
}

/** Rótulo de la lista y aviso cuando la ruta del día aún no se ha organizado. */
export function renderHomeHeader() {
  const route = routeSettlements[state.workerRoute];
  const weekday = new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(new Date());
  document.querySelector('#home-list-eyebrow').textContent = `${weekday} · RUTA ${route?.name || ''}`.toLocaleUpperCase('es');
  const organized = hasBuiltRoute();
  const hint = document.querySelector('#home-route-hint');
  hint.hidden = organized || state.userRole !== 'worker';
  hint.textContent = `${routeReadyMessage() || 'Aún no se ha armado la ruta del día.'} Ármala en «Ruta diaria» y aquí aparecerán los clientes que vas a visitar.`;
}

/** Muestra el total en caja dentro del botón "Tu base hoy" sin tener que abrirlo. */
export function updateCashChip(totalText) {
  const chip = document.querySelector('#home-cash-total-chip');
  if (chip) chip.textContent = `${totalText} en caja`;
}

/**
 * Botones de cobro en cada cliente del Inicio ("Registrar cuota" y "No pagó hoy").
 * Al usarlos, la visita se cierra y el cliente sale de esta lista.
 */
export function renderHomeRowActions() {
  const rows = [...document.querySelectorAll('#inicio .home-client-row')];
  rows.forEach(row => {
    // Asa para cambiar el orden de los clientes (como en «Ruta diaria»).
    if (!row.querySelector('.home-drag-handle')) {
      const handle = document.createElement('span');
      handle.className = 'home-drag-handle';
      handle.dataset.homeAction = 'drag';
      handle.textContent = '⠿';
      handle.title = 'Mantén presionado y arrastra para cambiar el orden';
      handle.setAttribute('aria-hidden', 'true');
      row.querySelector('.home-row-open')?.before(handle);
    }
    if (row.querySelector('.home-row-actions')) return;
    const actions = document.createElement('div');
    actions.className = 'home-row-actions';
    const pay = document.createElement('button');
    pay.type = 'button';
    pay.className = 'home-action-pay';
    pay.dataset.homeAction = 'pay';
    pay.innerHTML = '<span aria-hidden="true">＋</span> Registrar cuota';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'home-action-skip';
    skip.dataset.homeAction = 'no-payment';
    skip.textContent = 'No pagó hoy';
    actions.append(pay, skip);
    row.append(actions);
  });
  const anyVisible = rows.some(row => !row.hidden);
  const empty = document.querySelector('#home-route-done');
  const organized = hasBuiltRoute();
  // Buscando: los avisos de la ruta se ocultan y se dice cuántos clientes coinciden.
  const searching = Boolean(document.querySelector('#home-search')?.value.trim());
  const note = document.querySelector('#home-search-note');
  const found = rows.filter(row => !row.hidden).length;
  if (note) {
    note.hidden = !searching;
    note.textContent = found ? `${found} ${found === 1 ? 'cliente encontrado' : 'clientes encontrados'} en tu ruta` : 'No se encontraron clientes con esa búsqueda.';
  }
  if (empty) empty.hidden = searching || anyVisible || !organized || state.userRole !== 'worker';
  document.querySelector('#home-route-hint').hidden = searching || organized || state.userRole !== 'worker';
}

/**
 * Ordenar los clientes del Inicio arrastrando el asa ⠿ (dedo o mouse). Se suelta antes del
 * cliente de abajo o después, según la mitad de la fila; el orden se guarda en la ruta del día.
 */
let homeDrag = null;

function homeRowsVisible() {
  return [...document.querySelectorAll('#inicio .home-client-row')].filter(row => !row.hidden);
}

function homeDropSpot(x, y) {
  const row = document.elementFromPoint(x, y)?.closest('#inicio .home-client-row');
  if (!row || row.hidden) return null;
  const rect = row.getBoundingClientRect();
  const after = y > rect.top + rect.height / 2;
  const visible = homeRowsVisible();
  const next = after ? visible[visible.indexOf(row) + 1] : row;
  return { row, after, beforeId: next ? next.dataset.client : null };
}

function clearHomeDropMarks() {
  document.querySelectorAll('#inicio .home-client-row.is-drop-before, #inicio .home-client-row.is-drop-after').forEach(row => row.classList.remove('is-drop-before', 'is-drop-after'));
}

function mountHomeReorder() {
  const list = document.querySelector('#inicio .client-list');
  list.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.home-drag-handle');
    const row = handle?.closest('.home-client-row');
    if (!row || state.userRole !== 'worker' || !hasBuiltRoute()) return;
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    homeDrag = { id: row.dataset.client, pointerId: event.pointerId, startY: event.clientY, moved: false, row };
  });
  window.addEventListener('pointermove', event => {
    if (!homeDrag || event.pointerId !== homeDrag.pointerId) return;
    if (!homeDrag.moved && Math.abs(event.clientY - homeDrag.startY) > 6) { homeDrag.moved = true; homeDrag.row.classList.add('is-dragging'); }
    if (!homeDrag.moved) return;
    event.preventDefault();
    clearHomeDropMarks();
    const spot = homeDropSpot(event.clientX, event.clientY);
    if (spot && spot.row !== homeDrag.row) spot.row.classList.add(spot.after ? 'is-drop-after' : 'is-drop-before');
    // Cerca de los bordes de la pantalla se desplaza sola para llegar a clientes lejanos.
    if (event.clientY < 70) window.scrollBy(0, -12);
    else if (event.clientY > window.innerHeight - 90) window.scrollBy(0, 12);
  }, { passive: false });
  const finish = event => {
    if (!homeDrag || event.pointerId !== homeDrag.pointerId) return;
    const drag = homeDrag;
    homeDrag = null;
    drag.row.classList.remove('is-dragging');
    clearHomeDropMarks();
    if (!drag.moved || event.type === 'pointercancel') return;
    const spot = homeDropSpot(event.clientX, event.clientY);
    if (!spot || spot.row === drag.row) return;
    if (moveInRoute(drag.id, spot.beforeId === drag.id ? null : spot.beforeId)) {
      persistBusinessData();
      filterClientCards();
      renderRouteBuilder();
    }
  };
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  PANELS.forEach(([toggleSelector, panelSelector]) => {
    document.querySelector(toggleSelector).addEventListener('click', () => {
      const open = document.querySelector(toggleSelector).getAttribute('aria-expanded') !== 'true';
      setPanel(toggleSelector, panelSelector, open);
      if (open) document.querySelector(panelSelector).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
  mountHomeReorder();
  document.querySelector('#inicio .client-list').addEventListener('click', event => {
    const action = event.target.closest('[data-home-action]');
    if (!action || action.dataset.homeAction === 'drag') return;
    const clientId = action.closest('[data-client]')?.dataset.client;
    const client = clients[clientId];
    if (!client) return;
    if (action.dataset.homeAction === 'pay') {
      openClient(clientId);
      state.paymentFromHome = true;
      openPayment();
      return;
    }
    openCustomModal({
      title: 'Registrar que no pagó',
      description: `¿Confirmas que ${client.name} no pagó hoy? La visita se cerrará y saldrá de tu lista del Inicio.`,
      submitLabel: 'Sí, no pagó',
      onSubmit: () => markNoPayment(clientId)
    });
  });
  document.querySelectorAll('[data-go-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.goView)));
}
