/**
 * features/admin/admin-shell · Panel de administración: selector de ruta, secciones
 * y modo "directorio de ruta".
 */

import { adminView, operationsModal, routeSelect, shareLocationButton, workerView } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { routeSettlements } from '../../core/store.js';
import { renderClientMap } from './client-map.js';
import { renderRouteEvidence } from './evidence.js';
import { renderPendingRequests } from './pending.js';
import { renderPersonnel } from './personnel.js';
import { renderRouteReports } from './reports.js';
import { recalculateSettlement, renderRouteOperations } from './settlement.js';
import { filterClientCards } from '../clients/directory.js';
import { renderOperationsModal } from '../operations/operations-list.js';
import { showView } from '../../ui/navigation.js';
import { renderAccessSchedule } from './access-hours.js';
import { renderAccountSettings } from './account-settings.js';

/** «Hoy · 5 de octubre»: la fecha de la liquidación sale del reloj, no del marcado. */
export function renderRouteDate() {
  const label = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  document.querySelectorAll('.route-date').forEach(node => { node.textContent = `Hoy · ${label}`; });
  const now = new Date();
  const short = `${now.getDate()} ${['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][now.getMonth()]} ${now.getFullYear()}`;
  const header = document.querySelector('#admin-header-date');
  if (header) header.textContent = `CIERRE OPERATIVO · ${short}`;
}

/** Secciones que dependen de tener una ruta seleccionada. */
const ROUTE_PANELS = ['settlement', 'map', 'receipts', 'reports'];

/** Reconstruye el selector «Zonas / Rutas» con las rutas que existen. */
export function syncRouteSelect() {
  const previous = routeSelect.value;
  [...routeSelect.options].forEach(option => { if (!routeSettlements[option.value]) option.remove(); });
  Object.entries(routeSettlements).forEach(([id, route]) => {
    const option = [...routeSelect.options].find(item => item.value === id);
    if (option) option.textContent = route.name || id;
    else routeSelect.add(new Option(route.name || id, id));
  });
  if (routeSettlements[previous]) routeSelect.value = previous;
  else if (routeSelect.options.length) routeSelect.value = routeSelect.options[0].value;
  updateRouteAvailability();
}

/**
 * Sin rutas no hay liquidación, mapa, comprobantes ni reportes: se muestra un aviso que
 * lleva a Gestión de Personal, donde nacen las rutas.
 */
export function updateRouteAvailability() {
  const empty = !Object.keys(routeSettlements).length;
  document.body.classList.toggle('no-routes', empty);
  routeSelect.disabled = empty;
  routeSelect.hidden = empty;
  const hint = document.querySelector('#route-empty-hint');
  if (hint) hint.hidden = !empty;
  const directory = document.querySelector('#admin-global-directory');
  if (directory) directory.disabled = empty;
  const routePanel = ROUTE_PANELS.includes(state.activeAdminPanel || 'settlement');
  const notice = document.querySelector('#no-routes-notice');
  if (notice) notice.hidden = !(empty && routePanel);
  document.querySelectorAll('[data-admin-panel]').forEach(panel => {
    if (ROUTE_PANELS.includes(panel.dataset.adminPanel)) panel.hidden = empty || panel.dataset.adminPanel !== (state.activeAdminPanel || 'settlement');
  });
  if (empty) {
    const title = document.querySelector('#admin-title');
    if (title && routePanel) title.textContent = 'Panel de administración';
    state.activeSettlement = null;
  }
  return !empty;
}

/** Sección inicial del admin: Liquidación si hay rutas; si no, Gestión de Personal. */
export function defaultAdminPanel() {
  return Object.keys(routeSettlements).length ? 'settlement' : 'personnel';
}

export function renderAdminRoute(routeId) {
  renderRouteDate();
  const route = routeSettlements[routeId];
  if (!updateRouteAvailability() || !route) return;
  state.activeSettlement = route;
  document.querySelector('#admin-title').textContent = `Cuadre de Caja - Ruta ${route.name}`;
  document.querySelector('#metric-collections').value = route.collections;
  document.querySelector('#metric-base').value = route.base;
  document.querySelector('#metric-loans').value = route.loans;
  document.querySelector('#metric-expenses').value = route.expenses;
  document.querySelector('#metric-cash-delivered').value = route.cashDelivered;
  document.querySelector('#metric-other-expenses').value = route.otherExpenses;
  renderRouteOperations(route);
  renderRouteEvidence(routeId);
  renderRouteReports(route);
  recalculateSettlement();
}

export function enterAdminDirectory() {
  adminView.hidden = true;
  workerView.hidden = false;
  document.body.classList.add('admin-client-mode');
  state.userRole = 'admin';
  document.querySelector('#add-client').hidden = true;
  document.querySelector('#admin-add-client').hidden = false;
  document.querySelector('#nav-daily-route').hidden = true;
  document.querySelector('#nav-map').hidden = true;
  shareLocationButton.hidden = true;
  showView('directorio');
}

function returnToAdmin() {
  workerView.hidden = true;
  adminView.hidden = false;
  document.body.classList.remove('admin-client-mode');
  document.querySelector('#admin-add-client').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (state.activeAdminPanel === 'map') renderClientMap();
}

export function showAdminPanel(panelName) {
  state.activeAdminPanel = panelName;
  document.querySelectorAll('[data-admin-panel]').forEach(panel => { panel.hidden = panel.dataset.adminPanel !== panelName; });
  document.querySelectorAll('[data-admin-section]').forEach(button => {
    const active = button.dataset.adminSection === panelName;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  updateRouteAvailability();
  if (panelName === 'personnel') { renderPersonnel(); renderAccessSchedule(); }
  if (panelName === 'settings') renderAccountSettings();
  if (ROUTE_PANELS.includes(panelName) && routeSettlements[routeSelect.value]) renderAdminRoute(routeSelect.value);
  if (panelName === 'pending') renderPendingRequests();
  if (panelName === 'receipts' && routeSettlements[routeSelect.value]) renderRouteEvidence(routeSelect.value);
  if (panelName === 'map' && routeSettlements[routeSelect.value]) renderClientMap();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  renderRouteDate();
  window.setInterval(renderRouteDate, 60000); // cambia sola a medianoche
  routeSelect.addEventListener('change', () => {
    renderAdminRoute(routeSelect.value);
    renderPendingRequests();
    if (state.userRole === 'admin' && state.currentView === 'directorio') filterClientCards();
    if (operationsModal && !operationsModal.hidden) renderOperationsModal();
    if (state.activeAdminPanel === 'map' && !adminView.hidden) renderClientMap();
  });
  document.querySelector('#admin-global-directory').addEventListener('click', enterAdminDirectory);
  document.querySelector('#no-routes-go').addEventListener('click', () => showAdminPanel('personnel'));
  document.querySelector('#admin-directory-back').addEventListener('click', returnToAdmin);
  document.querySelectorAll('[data-admin-section]').forEach(button => button.addEventListener('click', () => showAdminPanel(button.dataset.adminSection)));
}
