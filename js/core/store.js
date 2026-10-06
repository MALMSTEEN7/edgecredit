/**
 * core/store · Datos de negocio (clientes, rutas, personal, solicitudes)
 * y su persistencia local. Punto único de lectura/escritura en localStorage.
 */

import { routeSelect } from './dom.js';
import { state } from './state.js';
import { routeKey } from '../shared/format.js';
import { showToast } from '../ui/toast.js';

// Sistema limpio: sin clientes, rutas ni personal. Cada ruta (cobro) nace al registrar
// un trabajador con esa ruta y desaparece cuando ya no tiene trabajador ni clientes.
export const clients = {};

/** Estructura vacía de un cobro (ruta). */
export function emptyRoute(name) {
  return {
    name, collections: 0, loans: 0, expenses: 0, base: 0, cashDelivered: 0, otherExpenses: 0, otherExpenseEntries: [],
    cardsCancelled: [], loansEntered: [], loansNew: [], weeklyCollections: 0, weeklyCardCount: 0, monthlyInsurance: 0,
    ledger: {}, cashBox: { opening: 0, openingDate: null }, insuranceCuts: [],
  };
}

export const routeSettlements = {};

/**
 * Versión de los datos. Al cambiarla, la app descarta en cada dispositivo los clientes y
 * movimientos guardados (arranque desde cero) y conserva personal, rutas y seguridad.
 */
export const DATA_EPOCH = 'inicio-limpio-2026-10';

export function ensureRoute(routeName) {
  const name = String(routeName || '').trim();
  const id = routeKey(name);
  if (!name || !id) return '';
  if (!routeSettlements[id]) routeSettlements[id] = emptyRoute(name);
  routeSettlements[id].name ||= name;
  routeSettlements[id].otherExpenseEntries ||= [];
  if (routeSelect && ![...routeSelect.options].some(option => option.value === id)) routeSelect.add(new Option(routeSettlements[id].name, id));
  return id;
}

export const personnel = [];

export const pendingRequests = [];

/**
 * Datos operativos compartidos por trabajador: caja del día (base en efectivo/bancos)
 * y última ubicación GPS. Se guardan con el resto de los datos (y se sincronizan con el
 * servidor cuando está configurado), así el admin y el trabajador ven lo mismo.
 */
export const shared = { workBases: {}, workerLocations: {} };

export const expandedPaymentHistory = new Set();

export function normalizeWorkerAccounts() {
  personnel.forEach(worker => {
    if (!worker.username) worker.username = worker.name.trim().split(/\s+/)[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    if (!worker.passwordHash) worker.passwordHash = 'd7389c596dbfe23720942ae714947573fde1b0b5c003b8aff2e687296c8c5c36';
  });
}

// Coordenadas y zona de los datos de demostración (Norte de Santander). Se aplican
// también a datos ya guardados en el dispositivo que todavía no tienen ubicación.
const DEMO_CLIENT_LOCATIONS = {};
const DEMO_WORKER_ZONES = {};

/** Completa departamento/ciudad de trabajadores y ubicación demo de clientes cuando faltan. */
export function normalizeGeoData() {
  personnel.forEach(worker => {
    const zone = DEMO_WORKER_ZONES[worker.id];
    if (zone && !worker.department) [worker.department, worker.city] = zone;
  });
  Object.entries(clients).forEach(([clientId, client]) => {
    const demo = DEMO_CLIENT_LOCATIONS[clientId];
    if (demo && !client.location) client.location = { latitude: demo[0], longitude: demo[1], source: 'demo', capturedAt: null };
  });
}

/**
 * Separa las dos notas del cliente: la nota del alta pasa a "Indicaciones del domicilio"
 * (solo lectura en detalles) y "Notas del cliente" queda como recuadro editable aparte.
 */
export function normalizeClientNotes() {
  Object.values(clients).forEach(client => {
    if (client.addressNotes === undefined) client.addressNotes = String(client.comment || '');
    if (client.notes === undefined) client.notes = '';
    delete client.comment; delete client.commentUpdatedAt; delete client.commentUpdatedBy;
  });
}

/**
 * Quita las rutas que ya no tienen trabajador asignado ni clientes (ni días cerrados en
 * su libro diario). Devuelve true si quitó alguna.
 */
export function pruneOrphanRoutes() {
  const used = new Set(personnel.map(worker => routeKey(worker.route)).filter(Boolean));
  Object.values(clients).forEach(client => { if (client?.route) used.add(client.route); });
  let removed = false;
  Object.keys(routeSettlements).forEach(id => {
    const route = routeSettlements[id];
    const hasHistory = Object.values(route?.ledger || {}).some(day => day?.closed);
    if (used.has(id) || hasHistory) return;
    delete routeSettlements[id];
    removed = true;
  });
  if (routeSelect) [...routeSelect.options].forEach(option => { if (!routeSettlements[option.value]) option.remove(); });
  return removed;
}

/** Trabajador asignado a una ruta (id normalizado), si existe. */
export function workerForRoute(routeId) {
  return personnel.find(worker => routeKey(worker.route) === routeId) || null;
}

/**
 * Seguridad del administrador (verificación en dos pasos). Los trabajadores guardan
 * su configuración en su propio registro de `personnel`.
 */
export const security = {
  admin: { totpSecret: null, recoveryHashes: [], totpLastStep: -1, enrolledAt: null },
  // Horario de acceso de los trabajadores (ver domain/access-schedule.js).
  workerAccess: { enabled: false, days: [1, 2, 3, 4, 5, 6], start: '06:00', end: '20:00' },
};

// Con servidor configurado, cada guardado avisa a la sincronización (core/sync.js).
const persistListeners = [];
export function onPersist(listener) { persistListeners.push(listener); }
/** En modo servidor los datos de negocio no se guardan en el navegador (equipos compartidos). */
let localPersistence = true;
export function setLocalPersistence(enabled) { localPersistence = enabled; }

export function persistBusinessData() {
  persistListeners.forEach(listener => { try { listener(); } catch { /* la sincronización informa sus errores */ } });
  if (!localPersistence) return;
  try {
    localStorage.setItem('edgecredit-business-data', JSON.stringify({ clients, routeSettlements, personnel, pendingRequests, dailyRouteOrder: state.dailyRouteOrder, clientLibraryOrder: state.clientLibraryOrder, collectedRouteClients: state.collectedRouteClients, routeVisitOutcomes: state.routeVisitOutcomes, security, shared, dataEpoch: DATA_EPOCH }));
  } catch { showToast('No se pudieron guardar los datos localmente en este dispositivo.'); }
}

export function hydrateBusinessData() {
  try {
    const saved = JSON.parse(localStorage.getItem('edgecredit-business-data') || 'null');
    if (!saved || typeof saved !== 'object') return;
    if (saved.security?.admin && typeof saved.security.admin === 'object') Object.assign(security.admin, saved.security.admin);
    if (saved.security?.workerAccess && typeof saved.security.workerAccess === 'object') Object.assign(security.workerAccess, saved.security.workerAccess);
    if (Array.isArray(saved.personnel)) personnel.splice(0, personnel.length, ...saved.personnel);
    // Datos de una versión anterior (demostración/pruebas): se arranca desde cero. Se
    // conservan el personal, la seguridad y los nombres de las rutas creadas.
    if (saved.dataEpoch !== DATA_EPOCH) {
      Object.values(saved.routeSettlements || {}).forEach(value => { if (value?.name) ensureRoute(value.name); });
      try {
        Object.keys(localStorage).filter(key => key.startsWith('edgecredit-work-base')).forEach(key => localStorage.removeItem(key));
      } catch { /* almacenamiento opcional */ }
      return;
    }
    if (saved.clients && typeof saved.clients === 'object') {
      Object.keys(clients).forEach(key => delete clients[key]);
      Object.assign(clients, saved.clients);
    }
    if (saved.routeSettlements && typeof saved.routeSettlements === 'object') {
      Object.entries(saved.routeSettlements).forEach(([key, value]) => {
        if (!value || typeof value !== 'object') return;
        const id = ensureRoute(value.name || key);
        if (id && routeSettlements[id]) Object.assign(routeSettlements[id], value, { name: value.name || key });
      });
    }
    if (Array.isArray(saved.pendingRequests)) pendingRequests.push(...saved.pendingRequests);
    if (saved.dailyRouteOrder && typeof saved.dailyRouteOrder === 'object') state.dailyRouteOrder = saved.dailyRouteOrder;
    if (saved.clientLibraryOrder && typeof saved.clientLibraryOrder === 'object') state.clientLibraryOrder = saved.clientLibraryOrder;
    if (saved.collectedRouteClients && typeof saved.collectedRouteClients === 'object') state.collectedRouteClients = saved.collectedRouteClients;
    if (saved.routeVisitOutcomes && typeof saved.routeVisitOutcomes === 'object') state.routeVisitOutcomes = saved.routeVisitOutcomes;
    if (saved.shared && typeof saved.shared === 'object') { Object.assign(shared.workBases, saved.shared.workBases || {}); Object.assign(shared.workerLocations, saved.shared.workerLocations || {}); }
  } catch { /* Datos guardados inválidos: se usan los valores iniciales. */ }
}
