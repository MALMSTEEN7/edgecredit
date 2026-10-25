/**
 * EdgeCredit · raíz de composición.
 * Monta cada módulo (contenedor) y ejecuta la secuencia de arranque.
 * No contiene lógica de negocio: solo orquesta.
 */

import * as moneyInputModule from './js/ui/money-input.js';
import * as customModalModule from './js/ui/custom-modal.js';
import * as themeModule from './js/ui/theme.js';
import * as networkModule from './js/ui/network.js';
import * as navigationModule from './js/ui/navigation.js';
import * as shortcutsModule from './js/ui/shortcuts.js';
import * as imageViewerModule from './js/ui/image-viewer.js';
import * as deviceTrustModule from './js/features/auth/device-trust.js';
import * as twoFactorModule from './js/features/auth/two-factor.js';
import * as sessionModule from './js/features/auth/session.js';
import * as directoryModule from './js/features/clients/directory.js';
import * as newClientModule from './js/features/clients/new-client.js';
import * as clientDetailModule from './js/features/clients/client-detail.js';
import * as interestModule from './js/features/clients/interest.js';
import * as paymentModule from './js/features/payments/payment.js';
import * as dailyRouteModule from './js/features/daily-route/daily-route.js';
import * as cashBoxModule from './js/features/worker/cash-box.js';
import * as expensesModule from './js/features/worker/expenses.js';
import * as homeModule from './js/features/worker/home.js';
import * as locationModule from './js/features/worker/location.js';
import * as adminShellModule from './js/features/admin/admin-shell.js';
import * as settlementModule from './js/features/admin/settlement.js';
import * as reportsModule from './js/features/admin/reports.js';
import * as pendingModule from './js/features/admin/pending.js';
import * as personnelModule from './js/features/admin/personnel.js';
import * as accessHoursModule from './js/features/admin/access-hours.js';
import * as accountSettingsModule from './js/features/admin/account-settings.js';
import * as legacyImportModule from './js/features/admin/legacy-import.js';
import * as clientMapModule from './js/features/admin/client-map.js';
import * as evidenceModule from './js/features/admin/evidence.js';
import * as operationsListModule from './js/features/operations/operations-list.js';
import { clientButtons, routeSelect } from './js/core/dom.js';
import { state } from './js/core/state.js';
import { clients, ensureRoute, hydrateBusinessData, pruneOrphanRoutes, normalizeClientNotes, normalizeGeoData, normalizeWorkerAccounts, persistBusinessData, personnel, routeSettlements, setLocalPersistence } from './js/core/store.js';
import { backendEnabled } from './js/core/backend.js';
import * as syncModule from './js/core/sync.js';
import { setRenderHook, syncRole } from './js/core/sync.js';
import { setAfterServerLoad } from './js/features/auth/session.js';
import { renderPersonnel } from './js/features/admin/personnel.js';
import { applyCarriedBases } from './js/features/admin/settlement.js';
import { renderRouteBuilder } from './js/features/daily-route/daily-route.js';
import { filterClientCards } from './js/features/clients/directory.js';
import { normalizeClientSchedules, pruneExpiredPaymentHistories } from './js/domain/loan-schedule.js';
import { normalizeCancelledCards } from './js/domain/accounting.js';
import { ensureLedger, pruneOldLedger } from './js/domain/ledger.js';
import { renderAdminRoute, syncRouteSelect } from './js/features/admin/admin-shell.js';
import { renderPendingRequests } from './js/features/admin/pending.js';
import { appendClientCards, renderClientRows } from './js/features/clients/directory.js';
import { loadWorkBase, updateCashTotal } from './js/features/worker/cash-box.js';
import { localDateISO, shiftDateISO } from './js/shared/dates.js';
import { routeKey } from './js/shared/format.js';
import { updateNetworkStatus } from './js/ui/network.js';
import { applyTheme } from './js/ui/theme.js';

/**
 * Composición de módulos (equivalente a un docker-compose): cada entrada es un
 * contenedor autónomo que expone mount(). El orden importa solo para listeners
 * que comparten el mismo evento global (keydown, pointermove/pointerup).
 */
const MODULES = [
  syncModule,
  moneyInputModule,
  customModalModule,
  themeModule,
  networkModule,
  navigationModule,
  shortcutsModule,
  imageViewerModule,
  deviceTrustModule,
  twoFactorModule,
  sessionModule,
  directoryModule,
  newClientModule,
  clientDetailModule,
  interestModule,
  paymentModule,
  dailyRouteModule,
  cashBoxModule,
  expensesModule,
  homeModule,
  locationModule,
  adminShellModule,
  settlementModule,
  reportsModule,
  pendingModule,
  personnelModule,
  accessHoursModule,
  accountSettingsModule,
  legacyImportModule,
  clientMapModule,
  evidenceModule,
  operationsListModule,
];

/** Secuencia de arranque: hidrata datos, normaliza y pinta el estado inicial. */
function boot() {
  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem('edgecredit-theme') || 'dark'; } catch { /* almacenamiento opcional */ }
  // Con servidor configurado los datos llegan al iniciar sesión (core/sync.js) y no se
  // guardan en el navegador; sin servidor se usa lo guardado en este dispositivo.
  if (backendEnabled()) {
    setLocalPersistence(false);
    personnel.splice(0, personnel.length);
    setAfterServerLoad(refreshFromServer);
    setRenderHook(refreshFromServer);
  } else hydrateBusinessData();
  Object.values(routeSettlements).forEach(route => { delete route.entries; });
  Object.values(routeSettlements).forEach(route => (route.cardsCancelled || []).forEach(entry => { if (!entry.date) entry.date = shiftDateISO(localDateISO(), -1); }));
  normalizeWorkerAccounts();
  normalizeGeoData();
  normalizeClientNotes();
  normalizeCancelledCards();
  Object.values(routeSettlements).forEach(ensureLedger);
  normalizeClientSchedules();
  pruneExpiredPaymentHistories();
  persistBusinessData();
  window.setInterval(pruneExpiredPaymentHistories, 60 * 60 * 1000);
  // Cierres de caja: se guardan los últimos 4 meses (sin servidor, en este navegador).
  if (!backendEnabled() && pruneLedgers()) persistBusinessData();
  if (!backendEnabled() && applyCarriedBases()) persistBusinessData();
  window.setInterval(() => {
    if ((!backendEnabled() || syncRole() === 'admin') && pruneLedgers()) persistBusinessData();
    if ((!backendEnabled() || syncRole()) && applyCarriedBases()) { persistBusinessData(); updateCashTotal(); }
  }, 60 * 60 * 1000);
  if (!backendEnabled()) pruneOrphanRoutes();
  syncRouteSelect();
  state.activeSettlement = routeSettlements[routeSelect.value] || null;
  state.activeWorker = personnel[0] || { id: 'worker-unassigned', name: 'Trabajador', route: '', openingAmount: 0 };
  state.workerRoute = routeKey(state.activeWorker.route);
  const initialClientIds = new Set(clientButtons.map(button => button.dataset.client));
  // Filas de todos los clientes; el filtro del directorio se aplica una sola vez al final.
  Object.keys(clients).forEach(clientId => {
    if (initialClientIds.has(clientId)) renderClientRows(clientId);
    else appendClientCards(clientId, { refresh: false });
  });
  filterClientCards();
  renderPendingRequests();
  applyTheme(savedTheme);
  renderAdminRoute(routeSelect.value);
  loadWorkBase(state.activeWorker);
  updateCashTotal();
  updateNetworkStatus();
}

/** Borra los cierres de caja de más de 4 meses en todos los cobros. ¿Borró algo? */
function pruneLedgers() {
  return Object.values(routeSettlements).map(route => pruneOldLedger(route)).some(Boolean);
}

/** Repinta todo tras cargar o recibir datos del servidor. */
function refreshFromServer() {
  personnel.forEach(worker => { if (worker.route) ensureRoute(worker.route); });
  Object.values(routeSettlements).forEach(ensureLedger);
  // El admin quita las rutas sin trabajador ni clientes (la sincronización las borra del servidor).
  if ((state.userRole === 'admin' || syncRole() === 'admin') && pruneOrphanRoutes()) persistBusinessData();
  // Solo el admin depura el libro (una sola fuente de cambios sobre las rutas).
  if ((state.userRole === 'admin' || syncRole() === 'admin') && pruneLedgers()) persistBusinessData();
  // Día nuevo: el efectivo del último cierre pasa a ser la base de hoy (admin o trabajador, el primero que entre).
  if (applyCarriedBases()) persistBusinessData();
  syncRouteSelect();
  state.activeSettlement = routeSettlements[routeSelect.value] || null;
  normalizeClientNotes();
  normalizeClientSchedules();
  const rendered = new Set([...document.querySelectorAll('#directorio .client-row')].map(row => row.dataset.client));
  Object.keys(clients).forEach(clientId => {
    if (rendered.has(clientId)) renderClientRows(clientId);
    else appendClientCards(clientId, { refresh: false });
  });
  filterClientCards();
  renderPendingRequests();
  if (state.userRole === 'admin') {
    if (routeSettlements[routeSelect.value]) renderAdminRoute(routeSelect.value);
    if (state.activeAdminPanel === 'personnel') renderPersonnel();
  } else {
    if (state.activeWorker) loadWorkBase(state.activeWorker);
    updateCashTotal();
    renderRouteBuilder();
  }
}

MODULES.forEach(module => module.mount());
boot();
