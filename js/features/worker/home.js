/**
 * features/worker/home · Inicio del trabajador: primero los clientes de la ruta del día;
 * "Tu caja hoy" y "Resumen del día" quedan plegados detrás de dos botones.
 */

import { state } from '../../core/state.js';
import { openClient } from '../clients/client-detail.js';
import { markNoPayment } from '../daily-route/daily-route.js';
import { openPayment } from '../payments/payment.js';
import { clients, routeSettlements } from '../../core/store.js';
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
  const organized = (state.dailyRouteOrder[state.workerRoute] || []).length > 0;
  document.querySelector('#home-route-hint').hidden = organized || state.userRole !== 'worker';
}

/** Muestra el total en caja dentro del botón "Tu caja hoy" sin tener que abrirlo. */
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
  const organized = (state.dailyRouteOrder[state.workerRoute] || []).length > 0;
  if (empty) empty.hidden = anyVisible || !organized || state.userRole !== 'worker';
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
  document.querySelector('#inicio .client-list').addEventListener('click', event => {
    const action = event.target.closest('[data-home-action]');
    if (!action) return;
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
