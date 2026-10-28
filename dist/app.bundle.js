/* ARCHIVO GENERADO por tools/bundle.mjs: no lo edites a mano. */
(() => {
'use strict';
// ── js/core/backend-config.js
/**
 * core/backend-config · Conexión con el servidor (Supabase).
 *
 * Con estos dos valores vacíos la app funciona como antes: cada dispositivo guarda sus
 * datos solo en su navegador (útil para pruebas individuales).
 *
 * Para trabajar en equipo lo normal es llenar config.js (raíz del proyecto), que tiene
 * prioridad y no requiere recompilar. Alternativamente copia aquí los
 * datos de tu proyecto: Supabase → Project Settings → API:
 *   - SUPABASE_URL      → «Project URL»   (https://xxxx.supabase.co)
 *   - SUPABASE_ANON_KEY → «anon public»   (es pública por diseño: la seguridad la
 *                                          hacen las reglas RLS de supabase/schema.sql)
 * NUNCA pongas aquí la clave «service_role».
 */
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

/** Los usuarios entran con un nombre corto (camila); por dentro Supabase usa camila@<dominio>. */
const AUTH_EMAIL_DOMAIN = 'edgecredit.app';

/** Librería oficial de Supabase (se descarga al iniciar sesión). */
const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

// ── js/core/backend.js
/**
 * core/backend · Cliente de Supabase (base de datos y autenticación en la nube).
 * Si no hay URL/clave configuradas, `backendEnabled()` es false y la app usa el modo local.
 */


// Permite inyectar otra conexión sin tocar el código (pruebas automáticas).
const override = globalThis.EDGECREDIT_BACKEND || {};
const BACKEND_URL = override.url || SUPABASE_URL;
const BACKEND_KEY = override.key || SUPABASE_ANON_KEY;

let client = null;
let loading = null;

function backendEnabled() {
  return Boolean(BACKEND_URL && BACKEND_KEY);
}

function loadLibrary() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SUPABASE_JS_URL;
    script.async = true;
    script.onload = () => (window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('No se pudo iniciar la conexión con el servidor.')));
    script.onerror = () => { loading = null; reject(new Error('Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.')); };
    document.head.append(script);
  });
  return loading;
}

/** Cliente principal (sesión del usuario que inició sesión). */
async function backend() {
  if (client) return client;
  const lib = await loadLibrary();
  client = lib.createClient(BACKEND_URL, BACKEND_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'edgecredit-auth' },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}

function usernameToEmail(username) {
  const clean = String(username || '').trim().toLocaleLowerCase('es');
  return clean.includes('@') ? clean : `${clean}@${AUTH_EMAIL_DOMAIN}`;
}

/** Mensaje entendible para errores de red o del servidor. */
function backendErrorMessage(error, fallback = 'No se pudo completar la operación en el servidor.') {
  const text = String(error?.message || error || '');
  if (/fetch|network|Failed to/i.test(text)) return 'Sin conexión con el servidor. Revisa tu internet.';
  if (/row-level security|permission denied/i.test(text)) return 'El servidor no permitió la operación (permisos, horario o acceso desactivado).';
  return text || fallback;
}

// ── js/core/config.js
/**
 * core/config · Constantes de negocio y catálogos (frecuencias, valores demo).
 */

const paymentFrequencyDays = { daily: 1, weekly: 7, biweekly: 15, monthly: 30 };

const paymentFrequencyLabels = { daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' };

const adminPasswordHash = 'b5af2beb9b7fd5aa4eb21b61925bd3856793e54e0a39052fbcfaf5b477fd07f3';

/**
 * MODO DE PRUEBA de «Cuadrar seguros» (temporal, para verificar el cálculo):
 * permite cuadrar cualquier mes, elegir la fecha y hora del cuadre, cuadrar varias veces
 * y deshacer el último cuadre. Para volver al funcionamiento normal (solo el mes en curso,
 * con la hora actual) cámbialo a false y ejecuta `node tools/bundle.mjs`.
 */
const INSURANCE_CUT_TEST_MODE = false;

// ── js/core/dom.js
/**
 * core/dom · Referencias a nodos estáticos de index.html.
 * Único lugar donde se consultan elementos fijos al cargar; los módulos los importan.
 */

const views = [...document.querySelectorAll('.view')];
const navItems = [...document.querySelectorAll('.nav-item[data-view]')];
const clientButtons = [...document.querySelectorAll('[data-client]')];
const detailView = document.querySelector('#detalle-cliente');
const modal = document.querySelector('#payment-modal');
const paymentForm = document.querySelector('#payment-form');
const voucherField = document.querySelector('#voucher-field');
const voucherFile = document.querySelector('#voucher-file');
const amountInput = document.querySelector('#payment-amount');
const disclosureButton = document.querySelector('.disclosure-button');
const creditDetails = document.querySelector('#credit-details');
const themeToggle = document.querySelector('#theme-toggle');
const themeDescription = document.querySelector('#theme-description');
const baseInput = document.querySelector('#work-base-input');
const cashTotal = document.querySelector('#cash-total');
const interestToggle = document.querySelector('#interest-toggle');
const interestModal = document.querySelector('#interest-modal');
const specificInterestForm = document.querySelector('#specific-interest-form');
const specificInterestInput = document.querySelector('#specific-interest-amount');
const loginGateway = document.querySelector('#login-gateway');
const workerView = document.querySelector('#worker-view');
const adminView = document.querySelector('#admin-view');
const routeSelect = document.querySelector('#route-select');
const adminFeedback = document.querySelector('#admin-feedback');
const settlementInputs = [...document.querySelectorAll('[data-settlement-field]')];
const personnelList = document.querySelector('#personnel-list');
const customModal = document.querySelector('#custom-modal');
const customModalForm = document.querySelector('#custom-modal-form');
const customModalFields = document.querySelector('#custom-modal-fields');
const customModalError = document.querySelector('#custom-modal-error');
const appToast = document.querySelector('#app-toast');
/** Testigo del GPS del trabajador (solo indica el estado; no es un botón). */
const gpsIndicator = document.querySelector('#gps-indicator');
const newClientModal = document.querySelector('#new-client-modal');
const newClientForm = document.querySelector('#new-client-form');
const newClientError = document.querySelector('#new-client-error');
const pendingList = document.querySelector('#pending-list');
const loginError = document.querySelector('#login-error');
const operationsModal = document.querySelector('#operations-list-modal');
const operationsResults = document.querySelector('#operations-list-results');
const operationsSearch = document.querySelector('#operations-list-search');
const directoryClientList = document.querySelector('#directorio .client-list');

// ── js/core/geo-colombia.js
/**
 * core/geo-colombia · Catálogo de departamentos de Colombia con su capital y una
 * caja aproximada [sur, oeste, norte, este] en grados. El mapa la usa para enfocar
 * el departamento del trabajador sin depender de un servicio de geocodificación.
 */

const COLOMBIA_BOUNDS = [[-4.3, -79.1], [12.6, -66.8]];

const DEPARTMENTS = [
  { name: 'Amazonas', capital: 'Leticia', center: [-4.215, -69.94], bbox: [-4.23, -74.4, 0.2, -69.4] },
  { name: 'Antioquia', capital: 'Medellín', center: [6.2442, -75.5812], bbox: [5.4, -77.1, 8.9, -73.85] },
  { name: 'Arauca', capital: 'Arauca', center: [7.0847, -70.7591], bbox: [6.0, -72.4, 7.1, -69.4] },
  { name: 'Atlántico', capital: 'Barranquilla', center: [10.9685, -74.7813], bbox: [10.27, -75.28, 11.11, -74.71] },
  { name: 'Bogotá D.C.', capital: 'Bogotá', center: [4.711, -74.0721], bbox: [3.73, -74.45, 4.84, -73.99] },
  { name: 'Bolívar', capital: 'Cartagena', center: [10.391, -75.4794], bbox: [7.0, -75.8, 10.8, -73.7] },
  { name: 'Boyacá', capital: 'Tunja', center: [5.5353, -73.3678], bbox: [4.65, -74.7, 7.1, -71.95] },
  { name: 'Caldas', capital: 'Manizales', center: [5.0703, -75.5138], bbox: [4.75, -75.95, 5.8, -74.65] },
  { name: 'Caquetá', capital: 'Florencia', center: [1.6144, -75.6062], bbox: [-1.0, -76.3, 2.35, -71.5] },
  { name: 'Casanare', capital: 'Yopal', center: [5.3378, -72.3959], bbox: [4.25, -73.1, 6.35, -69.8] },
  { name: 'Cauca', capital: 'Popayán', center: [2.4448, -76.6147], bbox: [0.95, -77.95, 3.35, -75.75] },
  { name: 'Cesar', capital: 'Valledupar', center: [10.4631, -73.2532], bbox: [7.65, -74.15, 10.85, -72.85] },
  { name: 'Chocó', capital: 'Quibdó', center: [5.6947, -76.6611], bbox: [3.95, -77.9, 8.7, -75.85] },
  { name: 'Córdoba', capital: 'Montería', center: [8.7479, -75.8814], bbox: [7.35, -76.5, 9.45, -74.75] },
  { name: 'Cundinamarca', capital: 'Bogotá', center: [4.711, -74.0721], bbox: [3.7, -74.9, 5.85, -73.05] },
  { name: 'Guainía', capital: 'Inírida', center: [3.8653, -67.9239], bbox: [1.15, -70.95, 4.05, -67.3] },
  { name: 'Guaviare', capital: 'San José del Guaviare', center: [2.5729, -72.6459], bbox: [0.6, -73.75, 2.95, -69.9] },
  { name: 'Huila', capital: 'Neiva', center: [2.9273, -75.2819], bbox: [1.55, -76.6, 3.85, -74.4] },
  { name: 'La Guajira', capital: 'Riohacha', center: [11.5444, -72.9072], bbox: [10.4, -73.65, 12.47, -71.1] },
  { name: 'Magdalena', capital: 'Santa Marta', center: [11.2408, -74.199], bbox: [8.9, -74.95, 11.35, -73.55] },
  { name: 'Meta', capital: 'Villavicencio', center: [4.142, -73.6266], bbox: [1.6, -74.9, 4.9, -71.05] },
  { name: 'Nariño', capital: 'Pasto', center: [1.2136, -77.2811], bbox: [0.35, -79.05, 2.7, -76.8] },
  { name: 'Norte de Santander', capital: 'Cúcuta', center: [7.8939, -72.5078], bbox: [6.85, -73.65, 9.3, -72.05] },
  { name: 'Putumayo', capital: 'Mocoa', center: [1.1462, -76.6478], bbox: [-0.45, -77.1, 1.45, -73.85] },
  { name: 'Quindío', capital: 'Armenia', center: [4.5339, -75.6811], bbox: [4.05, -75.9, 4.75, -75.35] },
  { name: 'Risaralda', capital: 'Pereira', center: [4.8133, -75.6961], bbox: [4.65, -76.35, 5.5, -75.4] },
  { name: 'San Andrés y Providencia', capital: 'San Andrés', center: [12.5847, -81.7006], bbox: [12.45, -81.75, 13.4, -81.3] },
  { name: 'Santander', capital: 'Bucaramanga', center: [7.1193, -73.1227], bbox: [5.7, -74.55, 8.15, -72.45] },
  { name: 'Sucre', capital: 'Sincelejo', center: [9.3047, -75.3978], bbox: [8.25, -75.75, 9.85, -74.5] },
  { name: 'Tolima', capital: 'Ibagué', center: [4.4389, -75.2322], bbox: [2.85, -76.1, 5.35, -74.45] },
  { name: 'Valle del Cauca', capital: 'Cali', center: [3.4516, -76.532], bbox: [3.05, -77.55, 5.05, -75.7] },
  { name: 'Vaupés', capital: 'Mitú', center: [1.2536, -70.2345], bbox: [-1.2, -71.95, 2.0, -69.1] },
  { name: 'Vichada', capital: 'Puerto Carreño', center: [6.189, -67.4859], bbox: [2.6, -71.1, 6.3, -67.4] },
];

function findDepartment(name) {
  const key = normalize(name);
  return DEPARTMENTS.find(item => normalize(item.name) === key) || null;
}

/** Opciones para un <select> de departamento (formato del modal genérico). */
function departmentOptions() {
  return [{ value: '', label: 'Selecciona un departamento' }, ...DEPARTMENTS.map(item => ({ value: item.name, label: item.name }))];
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es').trim();
}

// ── js/core/map-config.js
/**
 * core/map-config · Configuración del mapa de clientes.
 *
 * CARTO exige una API key en cada tesela (?key=...). Esta clave viaja al navegador,
 * así que es pública por naturaleza: protégela en el panel de CARTO con
 * "website restrictions" (dominios permitidos) en lugar de intentar ocultarla.
 * Si se deja vacía, el mapa usa las teselas estándar de OpenStreetMap.
 */
const CARTO_API_KEY = 'cb1_46nk_1_245cd44315c027f9a302c302';

// ── js/core/security-config.js
/**
 * core/security-config · Parámetros de seguridad del inicio de sesión:
 * verificación en dos pasos (app de autenticación), bloqueo por intentos fallidos y
 * dispositivos recordados.
 */

/** Verificación en dos pasos (TOTP con app de autenticación). */
const TWO_FACTOR_ISSUER = 'EdgeCredit';
const TWO_FACTOR_REQUIRED = true;

/** Bloqueo temporal tras varios intentos fallidos en este dispositivo. */
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

/**
 * Dispositivo recordado: tras verificar el código en un dispositivo y marcar
 * «Recordar este dispositivo», no se vuelve a pedir el código en ese navegador durante
 * estos días. En otro dispositivo (o al vencer el plazo) se pide de nuevo.
 */
const TRUSTED_DEVICE_DAYS = 30;

// ── js/core/state.js
/**
 * core/state · Estado de sesión y de UI compartido (mutable).
 * Se accede siempre como state.<clave> para que todos los módulos vean el mismo valor.
 */

const state = {
  customModalSubmit: null,
  customModalCancel: null,
  locationWatchId: null,
  lastLocationWrite: 0,
  lastFocusedElement: null,
  workerRoute: '',
  dailyRouteOrder: {},
  dailyRouteDates: {}, // día en que se armó la ruta de cada cobro (se reinicia al cambiar de día)
  clientLibraryOrder: {},
  collectedRouteClients: {},
  routeVisitOutcomes: {},
  draggedRouteClient: null,
  routePointerDrag: null,
  directoryPointerDrag: null,
  currentView: 'inicio',
  previousView: 'inicio',
  cardSequence: [], // cartulinas de la lista desde la que se abrió la ficha (Anterior / Siguiente)
  activeClient: null,
  activeWorker: null,
  activeSettlement: null,
  settlementDifference: 0,
  userRole: 'worker',
  activeAdminPanel: 'settlement',
  activeOperationList: 'entered',
  authenticatedWorker: null,
  paymentFromHome: false, // el abono se inició desde el Inicio: al guardarlo se vuelve al Inicio
};

// ── js/core/store.js
/**
 * core/store · Datos de negocio (clientes, rutas, personal, solicitudes)
 * y su persistencia local. Punto único de lectura/escritura en localStorage.
 */





// Sistema limpio: sin clientes, rutas ni personal. Cada ruta (cobro) nace al registrar
// un trabajador con esa ruta y desaparece cuando ya no tiene trabajador ni clientes.
const clients = {};

/** Estructura vacía de un cobro (ruta). */
function emptyRoute(name) {
  return {
    name, collections: 0, loans: 0, expenses: 0, base: 0, cashDelivered: 0, otherExpenses: 0, otherExpenseEntries: [],
    cardsCancelled: [], loansEntered: [], loansNew: [], weeklyCollections: 0, weeklyCardCount: 0, monthlyInsurance: 0,
    ledger: {}, cashBox: { opening: 0, openingDate: null }, insuranceCuts: [],
  };
}

const routeSettlements = {};

/**
 * Versión de los datos. Al cambiarla, la app descarta en cada dispositivo los clientes y
 * movimientos guardados (arranque desde cero) y conserva personal, rutas y seguridad.
 */
const DATA_EPOCH = 'inicio-limpio-2026-10';

function ensureRoute(routeName) {
  const name = String(routeName || '').trim();
  const id = routeKey(name);
  if (!name || !id) return '';
  if (!routeSettlements[id]) routeSettlements[id] = emptyRoute(name);
  routeSettlements[id].name ||= name;
  routeSettlements[id].otherExpenseEntries ||= [];
  if (routeSelect && ![...routeSelect.options].some(option => option.value === id)) routeSelect.add(new Option(routeSettlements[id].name, id));
  return id;
}

const personnel = [];

const pendingRequests = [];

/**
 * Datos operativos compartidos por trabajador: caja del día (base en efectivo/bancos)
 * y última ubicación GPS. Se guardan con el resto de los datos (y se sincronizan con el
 * servidor cuando está configurado), así el admin y el trabajador ven lo mismo.
 */
const shared = { workBases: {}, workerLocations: {} };

const expandedPaymentHistory = new Set();

function normalizeWorkerAccounts() {
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
function normalizeGeoData() {
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
function normalizeClientNotes() {
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
function pruneOrphanRoutes() {
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
function workerForRoute(routeId) {
  return personnel.find(worker => routeKey(worker.route) === routeId) || null;
}

/**
 * Seguridad del administrador (verificación en dos pasos). Los trabajadores guardan
 * su configuración en su propio registro de `personnel`.
 */
const security = {
  admin: { totpSecret: null, recoveryHashes: [], totpLastStep: -1, enrolledAt: null },
  // Horario de acceso de los trabajadores (ver domain/access-schedule.js).
  workerAccess: { enabled: false, days: [1, 2, 3, 4, 5, 6], start: '06:00', end: '20:00' },
  // Cierre de sesión por inactividad (horas sin usar la app). Lo cambia el admin en Configuración.
  session: { idleHours: 12 },
};

// Con servidor configurado, cada guardado avisa a la sincronización (core/sync.js).
const persistListeners = [];
function onPersist(listener) { persistListeners.push(listener); }
/** En modo servidor los datos de negocio no se guardan en el navegador (equipos compartidos). */
let localPersistence = true;
function setLocalPersistence(enabled) { localPersistence = enabled; }

function persistBusinessData() {
  persistListeners.forEach(listener => { try { listener(); } catch { /* la sincronización informa sus errores */ } });
  if (!localPersistence) return;
  try {
    localStorage.setItem('edgecredit-business-data', JSON.stringify({ clients, routeSettlements, personnel, pendingRequests, dailyRouteOrder: state.dailyRouteOrder, dailyRouteDates: state.dailyRouteDates, clientLibraryOrder: state.clientLibraryOrder, collectedRouteClients: state.collectedRouteClients, routeVisitOutcomes: state.routeVisitOutcomes, security, shared, dataEpoch: DATA_EPOCH }));
  } catch { showToast('No se pudieron guardar los datos localmente en este dispositivo.'); }
}

function hydrateBusinessData() {
  try {
    const saved = JSON.parse(localStorage.getItem('edgecredit-business-data') || 'null');
    if (!saved || typeof saved !== 'object') return;
    if (saved.security?.admin && typeof saved.security.admin === 'object') Object.assign(security.admin, saved.security.admin);
    if (saved.security?.workerAccess && typeof saved.security.workerAccess === 'object') Object.assign(security.workerAccess, saved.security.workerAccess);
    if (saved.security?.session && typeof saved.security.session === 'object') Object.assign(security.session, saved.security.session);
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
    if (saved.dailyRouteDates && typeof saved.dailyRouteDates === 'object') state.dailyRouteDates = saved.dailyRouteDates;
    if (saved.clientLibraryOrder && typeof saved.clientLibraryOrder === 'object') state.clientLibraryOrder = saved.clientLibraryOrder;
    if (saved.collectedRouteClients && typeof saved.collectedRouteClients === 'object') state.collectedRouteClients = saved.collectedRouteClients;
    if (saved.routeVisitOutcomes && typeof saved.routeVisitOutcomes === 'object') state.routeVisitOutcomes = saved.routeVisitOutcomes;
    if (saved.shared && typeof saved.shared === 'object') { Object.assign(shared.workBases, saved.shared.workBases || {}); Object.assign(shared.workerLocations, saved.shared.workerLocations || {}); }
  } catch { /* Datos guardados inválidos: se usan los valores iniciales. */ }
}

// ── js/core/sync.js
/**
 * core/sync · Sincronización con el servidor (Supabase) para trabajar en equipo.
 *
 * - Al iniciar sesión (o al restaurarla al abrir la app) descarga lo que el usuario puede
 *   ver: el admin todo; el trabajador solo su ruta (lo filtra la base de datos con RLS).
 *   Guarda un cursor con la hora del servidor (`server_now()`).
 * - Cada vez que la app guarda (persistBusinessData) compara cada registro con la última
 *   versión enviada y sube solo lo que cambió (clientes, rutas, estado de la ruta,
 *   solicitudes, personal y ajustes).
 * - Los cambios de otros usuarios llegan en tiempo real (vía principal) y se repinta la
 *   pantalla. Si el canal se cae se reconecta con espera progresiva.
 * - Respaldo incremental cada 60–90 s con la pestaña visible: solo las filas con
 *   `updated_at` posterior al cursor (menos 2 minutos de margen para transacciones lentas)
 *   y los borrados de `deleted_rows`. La descarga completa queda para: reconexión del
 *   tiempo real tras una caída, volver a la pestaña tras más de 10 minutos oculta, el
 *   evento `online` y un seguro cada 30 minutos.
 * - Nunca se pisa un registro con cambios locales sin enviar: se conserva el local y se envía.
 * - Sin internet, los cambios quedan en una cola (también guardada en el navegador) que se
 *   escribe al instante, así no se pierden si cierran la app; se envían al volver la conexión.
 */







const TABLE_KEYS = { clients: 'id', routes: 'id', route_state: 'route_id', pending_requests: 'id', profiles: 'user_id', app_settings: 'key' };
const DELETABLE = ['clients', 'pending_requests', 'routes', 'route_state'];
const PENDING_DELETE = '__pending-delete__';

const OVERLAP_MS = 2 * 60 * 1000;          // margen del cursor (transacciones lentas)
const POLL_MIN_MS = 60 * 1000;             // incremental cada 60–90 s
const POLL_JITTER_MS = 30 * 1000;
const FULL_SYNC_EVERY_MS = 30 * 60 * 1000; // descarga completa de seguro
const HIDDEN_FULL_SYNC_MS = 10 * 60 * 1000;
const FULL_SYNC_DEBOUNCE_MS = 5000;        // evita dos descargas completas seguidas
const RECONNECT_MAX_MS = 60 * 1000;

let syncSession = null;      // { userId, role, routeId, routeName }
let lastSynced = new Map();  // `${tabla}:${clave}` → JSON enviado/recibido
let loaded = false;          // ¿ya hubo una descarga completa en esta sesión?
let cursor = null;           // hora del servidor (ISO) de la última descarga
let lastFullSync = 0;
let syncing = false;         // descarga (completa o incremental) en curso
let flushTimer = null;
let flushing = null;         // promesa del envío en curso
let pollTimer = null;
let hiddenSince = 0;
let channel = null;
let channelGen = 0;
let realtime = 'off';        // 'off' | 'connecting' | 'live' | 'down'
let realtimeFailed = false;
let reconnectAttempt = 0;
let reconnectTimer = null;
let renderHook = () => {};
let accessHook = () => {};
let lastErrorToast = 0;

/** La app registra aquí cómo repintar tras cambios remotos (app.js). */
function setRenderHook(fn) { renderHook = fn; }
/** Se llama cuando cambia el perfil propio (p. ej. el admin desactivó el acceso). */
function setAccessHook(fn) { accessHook = fn; }
function syncActive() { return Boolean(syncSession); }
/** Rol de la sesión sincronizada ('admin' | 'worker'), o null sin servidor. */
function syncRole() { return syncSession?.role || null; }

const stable = value => JSON.stringify(value ?? null);
const outboxKey = () => `edgecredit-outbox-${syncSession?.userId}`;
const rowId = (table, key) => `${table}:${key}`;

// ── Del estado de la app a filas de la base de datos ──

function pickKeys(map, routeId) {
  return Object.fromEntries(Object.entries(map || {}).filter(([key]) => key === routeId || key.startsWith(`${routeId}:`)));
}

function workerIdsForRoute(routeId) {
  return personnel.filter(worker => routeKey(worker.route) === routeId).map(worker => worker.id);
}

function routeStateData(routeId) {
  const ids = workerIdsForRoute(routeId);
  if (syncSession?.role === 'worker' && state.activeWorker?.id && !ids.includes(state.activeWorker.id)) ids.push(state.activeWorker.id);
  return {
    dailyRouteOrder: state.dailyRouteOrder[routeId] || [],
    dailyRouteDate: state.dailyRouteDates[routeId] || '',
    clientLibraryOrder: state.clientLibraryOrder[routeId] || [],
    collectedRouteClients: pickKeys(state.collectedRouteClients, routeId),
    routeVisitOutcomes: pickKeys(state.routeVisitOutcomes, routeId),
    workBases: Object.fromEntries(ids.filter(id => shared.workBases[id]).map(id => [id, shared.workBases[id]])),
    workerLocations: Object.fromEntries(ids.filter(id => shared.workerLocations[id]).map(id => [id, shared.workerLocations[id]])),
  };
}

function visibleRouteIds() {
  return syncSession?.role === 'admin' ? Object.keys(routeSettlements) : [syncSession?.routeId].filter(Boolean);
}

function profileRow(worker) {
  const { id, username, passwordHash, totpSecret, recoveryHashes, totpLastStep, enrolledAt, email, ...data } = worker;
  return { user_id: id, route_id: routeKey(worker.route), access_enabled: worker.accessEnabled !== false, data };
}

const settingsRows = () => [{ key: 'worker_access', data: security.workerAccess }, { key: 'session', data: security.session }];

/** Filas actuales por tabla, según lo que este usuario puede escribir. */
function collectRows() {
  const routes = visibleRouteIds();
  const rows = {
    clients: Object.entries(clients).filter(([, client]) => client && routes.includes(client.route)).map(([id, client]) => ({ id, route_id: client.route, data: client })),
    routes: routes.filter(id => routeSettlements[id]).map(id => ({ id, data: routeSettlements[id] })),
    route_state: routes.map(id => ({ route_id: id, data: routeStateData(id) })),
    pending_requests: pendingRequests.filter(request => request?.id && (syncSession?.role === 'admin' || request.routeId === syncSession?.routeId)).map(request => ({ id: request.id, route_id: request.routeId || null, data: request })),
  };
  if (syncSession?.role === 'admin') {
    rows.profiles = personnel.filter(worker => worker.id && !String(worker.id).startsWith('worker-')).map(profileRow);
    rows.app_settings = settingsRows();
  }
  return rows;
}

/** Fila local actual de una clave (o null si no existe o este usuario no la escribe). */
function localRow(table, key) {
  const routes = visibleRouteIds();
  const admin = syncSession?.role === 'admin';
  if (table === 'clients') { const client = clients[key]; return client && routes.includes(client.route) ? { id: key, route_id: client.route, data: client } : null; }
  if (table === 'routes') return routes.includes(key) && routeSettlements[key] ? { id: key, data: routeSettlements[key] } : null;
  if (table === 'route_state') return routes.includes(key) ? { route_id: key, data: routeStateData(key) } : null;
  if (table === 'pending_requests') {
    const request = pendingRequests.find(item => item?.id === key);
    return request && (admin || request.routeId === syncSession?.routeId) ? { id: request.id, route_id: request.routeId || null, data: request } : null;
  }
  if (!admin) return null;
  if (table === 'profiles') { const worker = personnel.find(item => item.id === key && !String(item.id).startsWith('worker-')); return worker ? profileRow(worker) : null; }
  if (table === 'app_settings') return settingsRows().find(row => row.key === key) || null;
  return null;
}

/** ¿Este registro tiene cambios guardados aquí que aún no llegan al servidor? */
function hasUnsentChanges(table, key) {
  const local = localRow(table, key);
  return Boolean(local) && lastSynced.get(rowId(table, key)) !== stable(local);
}

// ── Envío de cambios ──

function readOutbox() {
  try { return JSON.parse(localStorage.getItem(outboxKey()) || '[]'); } catch { return []; }
}

function writeOutbox(items) {
  try { localStorage.setItem(outboxKey(), JSON.stringify(items)); } catch { /* opcional */ }
}

/** Cambios locales pendientes (lo que difiere de la última versión enviada/recibida). */
function pendingItems() {
  const pending = [];
  Object.entries(collectRows()).forEach(([table, list]) => {
    const keyName = TABLE_KEYS[table];
    const present = new Set();
    list.forEach(row => {
      const id = rowId(table, row[keyName]);
      present.add(id);
      if (lastSynced.get(id) !== stable(row)) pending.push({ table, op: 'upsert', row, id });
    });
    // Borrados: solo el admin elimina clientes, rutas (y su estado) y solicitudes.
    if (syncSession.role === 'admin' && DELETABLE.includes(table)) {
      [...lastSynced.keys()].filter(id => id.startsWith(`${table}:`) && !present.has(id))
        .forEach(id => pending.push({ table, op: 'delete', key: id.slice(table.length + 1), id }));
    }
  });
  return pending;
}

function scheduleFlush(delay = 400) {
  if (!syncSession) return;
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flush, delay);
}

/** Envía ya (al ocultar o cerrar la app): la cola queda escrita antes de cualquier espera. */
function flushNow() {
  if (!syncSession) return;
  window.clearTimeout(flushTimer);
  flush();
}

function flush() {
  // Antes de la primera descarga no hay con qué comparar: lo pendiente sigue en la cola.
  if (!syncSession || !loaded) return Promise.resolve();
  if (flushing || syncing) {
    // Ya hay un envío o una descarga: la cola se guarda igual y se reintenta enseguida.
    writeOutbox(pendingItems());
    scheduleFlush(500);
    return flushing || Promise.resolve();
  }
  // Paso síncrono: la cola queda guardada aunque la app se cierre en este instante.
  const pending = pendingItems();
  writeOutbox(pending);
  if (!pending.length || !navigator.onLine) { updateSyncBadge(); return Promise.resolve(); }
  flushing = sendPending(pending).finally(() => { flushing = null; updateSyncBadge(); });
  return flushing;
}

async function sendPending(pending) {
  try {
    const db = await backend();
    const failed = [];
    for (const table of Object.keys(TABLE_KEYS)) {
      const upserts = pending.filter(item => item.table === table && item.op === 'upsert');
      for (let i = 0; i < upserts.length; i += 50) {
        const chunk = upserts.slice(i, i + 50);
        // `updated_at` lo pone el servidor (trigger): no se envía la hora del dispositivo.
        const query = table === 'profiles'
          ? Promise.all(chunk.map(item => db.from('profiles').update({ route_id: item.row.route_id, access_enabled: item.row.access_enabled, data: item.row.data }).eq('user_id', item.row.user_id)))
            .then(results => ({ error: results.find(result => result.error)?.error || null }))
          : db.from(table).upsert(chunk.map(item => item.row), { onConflict: TABLE_KEYS[table] });
        const { error } = await query;
        if (error) { failed.push(...chunk); reportError(error); }
        else chunk.forEach(item => lastSynced.set(item.id, stable(item.row)));
      }
      const deletes = pending.filter(item => item.table === table && item.op === 'delete');
      if (deletes.length) {
        const { error } = await db.from(table).delete().in(TABLE_KEYS[table], deletes.map(item => item.key));
        if (error) { failed.push(...deletes); reportError(error); }
        else deletes.forEach(item => lastSynced.delete(item.id));
      }
    }
    // Lo que cambió mientras se enviaba también queda en la cola.
    writeOutbox(syncSession ? pendingItems() : failed);
    if (failed.length) scheduleFlush(15000);
    else if (syncSession && readOutbox().length) scheduleFlush(300);
  } catch (error) {
    reportError(error);
    scheduleFlush(15000);
  }
}

function reportError(error) {
  if (Date.now() - lastErrorToast < 20000) return;
  lastErrorToast = Date.now();
  showToast(`Cambios pendientes de enviar: ${backendErrorMessage(error)}`);
}

function updateSyncBadge() {
  const pending = syncSession ? readOutbox().length : 0;
  const offline = !navigator.onLine;
  const reconnecting = !offline && realtime === 'down';
  const status = offline ? 'offline' : pending ? 'pending' : reconnecting ? 'reconnecting' : 'ok';
  const titles = {
    offline: 'Sin conexión: los cambios se enviarán al volver internet',
    pending: `${pending} cambio(s) por enviar al servidor`,
    reconnecting: 'Tiempo real desconectado: reconectando. Mientras tanto los datos se actualizan cada minuto',
    ok: realtime === 'live' ? 'Datos sincronizados con el servidor (tiempo real activo)' : 'Datos sincronizados con el servidor',
  };
  const labels = { offline: 'Sin conexión', pending: 'Enviando…', reconnecting: 'Reconectando…', ok: 'Sincronizado' };
  document.querySelectorAll('.sync-status').forEach(badge => {
    badge.hidden = !syncSession;
    badge.dataset.state = status;
    badge.title = titles[status];
    badge.querySelector('span').textContent = labels[status];
  });
}

// ── Recepción de datos ──

function replaceObject(target, source) {
  Object.keys(target).forEach(key => delete target[key]);
  Object.assign(target, source);
}

function applyRouteState(routeId, data = {}) {
  state.dailyRouteOrder[routeId] = data.dailyRouteOrder || [];
  if (data.dailyRouteDate) state.dailyRouteDates[routeId] = data.dailyRouteDate;
  else delete state.dailyRouteDates[routeId];
  state.clientLibraryOrder[routeId] = data.clientLibraryOrder || [];
  Object.keys(state.collectedRouteClients).filter(key => key === routeId || key.startsWith(`${routeId}:`)).forEach(key => delete state.collectedRouteClients[key]);
  Object.assign(state.collectedRouteClients, data.collectedRouteClients || {});
  Object.keys(state.routeVisitOutcomes).filter(key => key === routeId || key.startsWith(`${routeId}:`)).forEach(key => delete state.routeVisitOutcomes[key]);
  Object.assign(state.routeVisitOutcomes, data.routeVisitOutcomes || {});
  Object.assign(shared.workBases, data.workBases || {});
  Object.assign(shared.workerLocations, data.workerLocations || {});
}

function profileToWorker(profile) {
  return { ...(profile.data || {}), id: profile.user_id, username: profile.username, email: profile.email, accessEnabled: profile.access_enabled !== false };
}

/** Forma de una fila tal como la envía esta app (para comparar con lo recibido). */
function normalizeRow(table, row) {
  if (table === 'profiles') return { user_id: row.user_id, route_id: row.route_id, access_enabled: row.access_enabled !== false, data: row.data };
  if (table === 'app_settings') return { key: row.key, data: row.data };
  if (table === 'routes') return { id: row.id, data: row.data };
  if (table === 'route_state') return { route_id: row.route_id, data: row.data };
  return { id: row.id, route_id: row.route_id, data: row.data };
}

/** Aplica una fila recibida del servidor al estado de la app. */
function applyRow(table, row, removed = false) {
  const keyName = TABLE_KEYS[table];
  const id = rowId(table, row[keyName]);
  if (removed) {
    lastSynced.delete(id);
    if (table === 'clients') delete clients[row.id];
    if (table === 'pending_requests') { const index = pendingRequests.findIndex(item => item.id === row.id); if (index >= 0) pendingRequests.splice(index, 1); }
    if (table === 'routes' && syncSession?.role === 'admin') delete routeSettlements[row.id];
    return;
  }
  if (table === 'clients') {
    if (clients[row.id]) replaceObject(clients[row.id], row.data); else clients[row.id] = row.data;
    lastSynced.set(id, stable({ id: row.id, route_id: row.route_id, data: clients[row.id] }));
  } else if (table === 'routes') {
    if (routeSettlements[row.id]) replaceObject(routeSettlements[row.id], { ...emptyRoute(row.data?.name || row.id), ...row.data });
    else routeSettlements[row.id] = { ...emptyRoute(row.data?.name || row.id), ...row.data };
    lastSynced.set(id, stable({ id: row.id, data: routeSettlements[row.id] }));
  } else if (table === 'route_state') {
    applyRouteState(row.route_id, row.data);
    lastSynced.set(id, stable({ route_id: row.route_id, data: routeStateData(row.route_id) }));
  } else if (table === 'pending_requests') {
    const index = pendingRequests.findIndex(item => item.id === row.id);
    if (index >= 0) pendingRequests[index] = row.data; else pendingRequests.push(row.data);
    lastSynced.set(id, stable({ id: row.id, route_id: row.route_id, data: row.data }));
  } else if (table === 'profiles') {
    if (row.user_id === syncSession?.userId && syncSession.role === 'worker') {
      const me = personnel.find(worker => worker.id === row.user_id);
      if (me) replaceObject(me, { ...profileToWorker(row), route: row.data?.route || me.route });
      accessHook(row);
      return;
    }
    if (syncSession?.role !== 'admin' || row.role !== 'worker') return;
    const worker = profileToWorker(row);
    const index = personnel.findIndex(item => item.id === row.user_id);
    if (index >= 0) replaceObject(personnel[index], worker); else personnel.push(worker);
    lastSynced.set(id, stable(profileRow(personnel.find(item => item.id === row.user_id))));
  } else if (table === 'app_settings') {
    const target = row.key === 'worker_access' ? security.workerAccess : row.key === 'session' ? security.session : null;
    if (!target) return;
    Object.assign(target, row.data || {});
    lastSynced.set(id, stable({ key: row.key, data: target }));
    if (row.key === 'session') rememberSessionSettings();
    if (row.key === 'worker_access' && syncSession?.role === 'worker') accessHook(null);
  }
}

/** El tiempo de inactividad se recuerda en el dispositivo para revisarlo antes de conectarse. */
function rememberSessionSettings() {
  try { localStorage.setItem('edgecredit-session-settings', JSON.stringify(security.session)); } catch { /* opcional */ }
}

/**
 * Regla común del tiempo real y del refresco incremental: aplica la fila salvo que sea el eco
 * de lo propio o que aquí haya cambios del mismo registro sin enviar (gana el último en
 * guardar: se conserva el local y se envía). Devuelve true si cambió algo.
 */
function receiveRow(table, row, removed = false) {
  if (!syncSession || !row) return false;
  const key = row[TABLE_KEYS[table]];
  if (key === undefined || key === null) return false;
  if (table === 'profiles' && syncSession.role === 'worker' && row.user_id !== syncSession.userId) return false;
  const id = rowId(table, key);
  if (!removed && lastSynced.get(id) === stable(normalizeRow(table, row))) return false;
  if (hasUnsentChanges(table, key)) { scheduleFlush(100); return false; }
  if (removed && !lastSynced.has(id) && !localRow(table, key)) return false;
  applyRow(table, row, removed);
  return true;
}

let renderTimer = null;
function queueRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => { try { renderHook(); } catch (error) { console.error(error); } }, 150);
}

async function serverNow(db) {
  const { data, error } = await db.rpc('server_now');
  if (error || !data) throw error || new Error('Sin hora del servidor');
  return new Date(data).toISOString();
}

function tableQueries(db, since) {
  const tables = ['routes', 'route_state', 'clients', 'pending_requests', 'app_settings', 'profiles'];
  return tables.map(table => {
    let query = db.from(table).select('*');
    // El admin trae a todos los trabajadores; el trabajador solo su propio perfil (acceso activo o no).
    if (table === 'profiles') query = syncSession.role === 'admin' ? query.eq('role', 'worker') : query.eq('user_id', syncSession.userId);
    if (since) query = query.gt('updated_at', since);
    return query.then(result => ({ table, ...result }));
  });
}

/**
 * Trabajador: antes de una descarga completa se revisa su perfil y el horario. Si el admin
 * le quitó el acceso o terminó el horario, el servidor ya no le muestra la ruta: en vez de
 * vaciar la pantalla se avisa a la sesión (que la cierra).
 */
async function workerMayDownload(db) {
  if (syncSession.role !== 'worker') return true;
  const [profile, settings] = await Promise.all([
    db.from('profiles').select('*').eq('user_id', syncSession.userId).maybeSingle(),
    db.from('app_settings').select('*').eq('key', 'worker_access').maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (settings.data?.data) Object.assign(security.workerAccess, settings.data.data);
  const blocked = profile.data?.access_enabled === false || !isWithinSchedule(security.workerAccess);
  if (blocked) {
    if (profile.data) accessHook(profile.data);
    else accessHook(null);
  }
  return !blocked;
}

/**
 * Descarga completa. Conserva la cola de salida y los cambios locales sin enviar: se
 * vuelven a aplicar sobre lo descargado y se envían.
 */
async function downloadAll() {
  const db = await backend();
  if (!(await workerMayDownload(db))) throw new Error('Acceso no disponible en este momento.');
  const [stamp, ...results] = await Promise.all([serverNow(db), ...tableQueries(db, null)]);
  const failure = results.find(result => result.error);
  if (failure) throw failure.error;
  if (!syncSession) return;
  // Desde aquí todo es síncrono: no se cuela ningún cambio entre la foto local y la carga.
  const pending = loaded ? pendingItems() : readOutbox();
  Object.keys(clients).forEach(key => delete clients[key]);
  pendingRequests.splice(0, pendingRequests.length);
  const previousWorkers = syncSession.role === 'admin' ? personnel.splice(0, personnel.length) : [];
  // El admin ve exactamente las rutas del servidor (nada de rutas locales sobrantes).
  if (syncSession.role === 'admin') Object.keys(routeSettlements).forEach(key => delete routeSettlements[key]);
  if (syncSession.role === 'worker') Object.keys(routeSettlements).filter(key => key !== syncSession.routeId).forEach(key => delete routeSettlements[key]);
  lastSynced = new Map();
  results.forEach(result => (result.data || []).forEach(row => applyRow(result.table, row)));
  if (syncSession.role === 'worker' && !routeSettlements[syncSession.routeId]) routeSettlements[syncSession.routeId] = emptyRoute(syncSession.routeName || syncSession.routeId);
  restorePending(pending, previousWorkers);
  cursor = stamp;
  lastFullSync = Date.now();
  loaded = true;
}

/** Vuelve a aplicar lo que estaba sin enviar (gana lo local) para que el próximo envío lo suba. */
function restorePending(pending, previousWorkers = []) {
  pending.forEach(item => {
    if (!TABLE_KEYS[item.table]) return;
    if (item.op === 'delete') {
      applyRow(item.table, { [TABLE_KEYS[item.table]]: item.key }, true);
      lastSynced.set(item.id, PENDING_DELETE);
      return;
    }
    if (item.table === 'profiles') {
      const index = personnel.findIndex(worker => worker.id === item.row.user_id);
      const base = index >= 0 ? personnel[index] : previousWorkers.find(worker => worker.id === item.row.user_id);
      if (!base) return;
      const worker = { ...base, ...item.row.data, id: item.row.user_id, accessEnabled: item.row.access_enabled !== false };
      if (index >= 0) replaceObject(personnel[index], worker); else personnel.push(worker);
    } else applyRow(item.table, item.row);
    lastSynced.delete(item.id);
  });
}

/**
 * Descarga completa en segundo plano (reconexión, regreso a la pestaña, `online`, seguro de
 * 30 minutos). Primero envía lo pendiente; los errores se reintentan en el siguiente ciclo.
 */
async function fullSync() {
  if (!syncSession || syncing || !navigator.onLine) return;
  if (Date.now() - lastFullSync < FULL_SYNC_DEBOUNCE_MS) return;
  syncing = true;
  try {
    await flushing;
    await downloadAll();
    queueRender();
    if (readOutbox().length || pendingItems().length) scheduleFlush(50);
  } catch { /* se reintenta en el siguiente ciclo */ }
  finally { syncing = false; updateSyncBadge(); }
}

/** Refresco incremental: filas cambiadas desde el cursor (con margen) y borrados. */
async function pullChanges() {
  if (!syncSession || syncing || !loaded || !cursor || !navigator.onLine) return;
  syncing = true;
  try {
    const db = await backend();
    const since = new Date(Date.parse(cursor) - OVERLAP_MS).toISOString();
    // La hora del servidor se toma al empezar: lo que se confirme mientras se descarga
    // queda después del nuevo cursor y entra en el siguiente ciclo.
    const [stamp, deleted, ...results] = await Promise.all([
      serverNow(db),
      db.from('deleted_rows').select('*').gt('deleted_at', since),
      ...tableQueries(db, since),
    ]);
    const failure = [deleted, ...results].find(result => result.error);
    if (failure) throw failure.error;
    if (!syncSession) return;
    const latest = new Map();
    results.forEach(result => (result.data || []).forEach(row => latest.set(rowId(result.table, row[TABLE_KEYS[result.table]]), String(row.updated_at || ''))));
    let changed = false;
    // Primero los borrados (salvo que la fila se haya vuelto a crear después), luego las filas.
    (deleted.data || []).forEach(entry => {
      const table = entry.table_name;
      if (!TABLE_KEYS[table]) return;
      if ((latest.get(rowId(table, entry.row_key)) || '') > String(entry.deleted_at || '')) return;
      changed = receiveRow(table, { [TABLE_KEYS[table]]: entry.row_key }, true) || changed;
    });
    results.forEach(result => (result.data || []).forEach(row => { changed = receiveRow(result.table, row) || changed; }));
    cursor = stamp;
    if (changed) queueRender();
  } catch { /* se reintenta en el siguiente ciclo */ }
  finally { syncing = false; updateSyncBadge(); }
}

function schedulePoll() {
  window.clearTimeout(pollTimer);
  if (!syncSession) return;
  pollTimer = window.setTimeout(pollTick, POLL_MIN_MS + Math.random() * POLL_JITTER_MS);
}

async function pollTick() {
  if (syncSession && !document.hidden && navigator.onLine) {
    if (Date.now() - lastFullSync >= FULL_SYNC_EVERY_MS) await fullSync();
    else await pullChanges();
  }
  schedulePoll();
}

// ── Tiempo real ──

async function subscribeRealtime() {
  if (!syncSession) return;
  const gen = ++channelGen;
  window.clearTimeout(reconnectTimer);
  const db = await backend();
  if (gen !== channelGen || !syncSession) return;
  removeChannel(db);
  setRealtime('connecting');
  const current = db.channel(`edgecredit-${syncSession.userId}-${gen}`);
  channel = current;
  Object.keys(TABLE_KEYS).forEach(table => {
    current.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
      if (gen !== channelGen) return;
      const removed = payload.eventType === 'DELETE';
      if (receiveRow(table, removed ? payload.old : payload.new, removed)) queueRender();
    });
  });
  current.subscribe(status => {
    if (gen !== channelGen || !syncSession) return;
    if (status === 'SUBSCRIBED') {
      window.clearTimeout(reconnectTimer);
      const recovering = realtimeFailed;
      realtimeFailed = false;
      reconnectAttempt = 0;
      setRealtime('live');
      // Lo que pasó mientras el canal estaba caído no llegó: descarga completa.
      if (recovering) { lastFullSync = 0; fullSync(); }
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      realtimeFailed = true;
      setRealtime('down');
      scheduleReconnect();
    }
  });
}

function removeChannel(db) {
  const old = channel;
  channel = null;
  if (!old) return;
  try { (db?.removeChannel ? db.removeChannel(old) : old.unsubscribe?.())?.catch?.(() => {}); } catch { /* ya cerrado */ }
}

/** Reintento con espera progresiva: 1 s, 2 s, 4 s… hasta 1 minuto (con un poco de azar). */
function scheduleReconnect() {
  window.clearTimeout(reconnectTimer);
  if (!syncSession) return;
  const delay = Math.min(RECONNECT_MAX_MS, 1000 * 2 ** reconnectAttempt) + Math.random() * 500;
  reconnectAttempt += 1;
  reconnectTimer = window.setTimeout(() => {
    if (!syncSession) return;
    if (!navigator.onLine) { scheduleReconnect(); return; }
    subscribeRealtime();
  }, delay);
}

function setRealtime(status) {
  realtime = status;
  updateSyncBadge();
}

// ── Ciclo de vida ──

/** Inicia la sincronización tras un inicio de sesión exitoso (o una sesión restaurada). */
async function startSync({ userId, role, routeId, routeName }) {
  syncSession = { userId, role, routeId, routeName };
  loaded = false;
  cursor = null;
  lastFullSync = 0;
  lastSynced = new Map();
  realtimeFailed = false;
  reconnectAttempt = 0;
  syncing = true;
  try {
    await downloadAll();
  } catch (error) {
    syncSession = null;
    throw error;
  } finally {
    syncing = false;
  }
  subscribeRealtime();
  schedulePoll();
  // Cambios que quedaron sin enviar en una sesión anterior en este dispositivo.
  scheduleFlush(readOutbox().length ? 50 : 300);
  updateSyncBadge();
}

async function stopSync() {
  if (syncSession) {
    // flush() guarda la cola en el acto (antes de cualquier espera) y envía lo que pueda.
    window.clearTimeout(flushTimer);
    await flush().catch(() => {});
    await flushing;
  }
  window.clearTimeout(flushTimer);
  window.clearTimeout(pollTimer);
  window.clearTimeout(reconnectTimer);
  channelGen += 1;
  if (channel) removeChannel(await backend().catch(() => null));
  syncSession = null;
  loaded = false;
  cursor = null;
  realtime = 'off';
  lastSynced = new Map();
  updateSyncBadge();
}

function __mount_syncModule() {
  onPersist(() => scheduleFlush());
  window.addEventListener('online', () => {
    updateSyncBadge();
    if (!syncSession) return;
    scheduleFlush(100);
    if (realtimeFailed) { reconnectAttempt = 0; subscribeRealtime(); }
    lastFullSync = 0;
    fullSync();
  });
  window.addEventListener('offline', updateSyncBadge);
  document.addEventListener('visibilitychange', () => {
    if (!syncSession) return;
    if (document.hidden) { hiddenSince = Date.now(); flushNow(); return; }
    const away = hiddenSince ? Date.now() - hiddenSince : 0;
    hiddenSince = 0;
    if (away > HIDDEN_FULL_SYNC_MS) { lastFullSync = 0; fullSync(); }
    else if (away > 0) pullChanges();
    schedulePoll();
  });
  // Al cerrar la app o cambiar de página: la cola queda guardada y se intenta enviar.
  window.addEventListener('pagehide', flushNow);
}

// ── js/core/tracks.js
/**
 * core/tracks · Recorrido GPS de los trabajadores (seguimiento continuo).
 *
 * - El celular del trabajador agrega puntos con `recordTrackPoint`. Con servidor van a la
 *   tabla `worker_positions` (supabase/schema.sql); si no hay internet quedan en una cola
 *   del navegador y se envían al volver la conexión. Sin servidor (modo local) se guardan
 *   en este navegador.
 * - El admin lee el recorrido de un día con `loadTrack` y recibe los puntos nuevos al
 *   instante con `subscribeTrack`.
 */



const LOCAL_TRACKS_KEY = 'edgecredit-tracks';
const LOCAL_DAYS_KEPT = 7;
const OUTBOX_LIMIT = 5000;           // ~2 días de puntos sin conexión; después se descartan los más viejos
const RETENTION_DAYS = 90;           // el admin borra lo más antiguo al consultar
const trackOutboxKey = workerId => `edgecredit-track-outbox-${workerId}`;
const localListeners = new Set();
let flushingTrack = false;
let trackFlushTimer = null;
let pruned = false;

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento lleno o bloqueado */ }
}

/** Punto como lo usa la app: { latitude, longitude, accuracy, speed, recordedAt }. */
const pointFromRow = row => ({
  latitude: Number(row.latitude), longitude: Number(row.longitude),
  accuracy: row.accuracy == null ? null : Number(row.accuracy),
  speed: row.speed == null ? null : Number(row.speed),
  recordedAt: row.recorded_at || row.recordedAt,
});

function dayBounds(dateISO) {
  const [year, month, day] = dateISO.split('-').map(Number);
  return { from: new Date(year, month - 1, day).toISOString(), to: new Date(year, month - 1, day + 1).toISOString() };
}

// ── Modo local ──

function saveLocalPoint(workerId, point) {
  const all = readJSON(LOCAL_TRACKS_KEY, {});
  const day = localDateISO(new Date(point.recordedAt));
  all[workerId] ||= {};
  (all[workerId][day] ||= []).push(point);
  Object.keys(all[workerId]).sort().slice(0, -LOCAL_DAYS_KEPT).forEach(key => delete all[workerId][key]);
  writeJSON(LOCAL_TRACKS_KEY, all);
  localListeners.forEach(listener => listener(workerId, point));
}

// ── Servidor ──

async function flushTrackOutbox(workerId) {
  if (flushingTrack || !navigator.onLine) return;
  const queue = readJSON(trackOutboxKey(workerId), []);
  if (!queue.length) return;
  flushingTrack = true;
  try {
    const db = await backend();
    const batch = queue.slice(0, 200);
    const { error } = await db.from('worker_positions').insert(batch);
    if (error) throw error;
    writeJSON(trackOutboxKey(workerId), readJSON(trackOutboxKey(workerId), []).slice(batch.length));
    if (queue.length > batch.length) scheduleTrackFlush(workerId, 200);
  } catch {
    scheduleTrackFlush(workerId, 30000); // sin conexión o servidor sin la tabla: se reintenta
  } finally {
    flushingTrack = false;
  }
}

function scheduleTrackFlush(workerId, delay = 1000) {
  window.clearTimeout(trackFlushTimer);
  trackFlushTimer = window.setTimeout(() => flushTrackOutbox(workerId), delay);
}

/** Agrega un punto del recorrido del trabajador. */
function recordTrackPoint(workerId, routeId, point) {
  if (!workerId) return;
  if (!backendEnabled()) { saveLocalPoint(workerId, point); return; }
  const queue = readJSON(trackOutboxKey(workerId), []);
  queue.push({
    route_id: routeId || null, latitude: point.latitude, longitude: point.longitude,
    accuracy: point.accuracy, speed: point.speed, recorded_at: point.recordedAt,
  });
  writeJSON(trackOutboxKey(workerId), queue.slice(-OUTBOX_LIMIT));
  scheduleTrackFlush(workerId);
}

/** Envía lo que quedó en cola al volver internet (lo llama el módulo de ubicación). */
function resumeTrackUpload(workerId) {
  if (backendEnabled() && workerId) scheduleTrackFlush(workerId, 500);
}

/** Recorrido de un trabajador en un día (yyyy-mm-dd), en orden de hora. */
async function loadTrack(workerId, dateISO) {
  if (!workerId) return [];
  if (!backendEnabled()) return [...(readJSON(LOCAL_TRACKS_KEY, {})[workerId]?.[dateISO] || [])];
  const db = await backend();
  if (!pruned) {
    pruned = true;
    const limit = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
    db.from('worker_positions').delete().lt('recorded_at', limit).then(() => {}, () => {});
  }
  const { from, to } = dayBounds(dateISO);
  const { data, error } = await db.from('worker_positions')
    .select('latitude, longitude, accuracy, speed, recorded_at')
    .eq('worker_id', workerId).gte('recorded_at', from).lt('recorded_at', to)
    .order('recorded_at', { ascending: true }).limit(5000);
  if (error) throw error;
  return (data || []).map(pointFromRow);
}

/** Puntos nuevos del trabajador en tiempo real. Devuelve la función para dejar de escuchar. */
function subscribeTrack(workerId, onPoint) {
  if (!workerId) return () => {};
  if (!backendEnabled()) {
    const listener = (id, point) => { if (id === workerId) onPoint(point); };
    const storage = event => {
      if (event.key !== LOCAL_TRACKS_KEY) return;
      const day = readJSON(LOCAL_TRACKS_KEY, {})[workerId]?.[localDateISO()] || [];
      if (day.length) onPoint(day[day.length - 1]);
    };
    localListeners.add(listener);
    window.addEventListener('storage', storage); // otra pestaña = otro «celular» en las pruebas
    return () => { localListeners.delete(listener); window.removeEventListener('storage', storage); };
  }
  let channel = null;
  let stopped = false;
  backend().then(db => {
    if (stopped) return;
    channel = db.channel(`track-${workerId}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'worker_positions', filter: `worker_id=eq.${workerId}` }, payload => onPoint(pointFromRow(payload.new)))
      .subscribe();
  }, () => {});
  return () => { stopped = true; channel?.unsubscribe?.(); };
}

/** Distancia en metros entre dos puntos (fórmula del haversine). */
function trackDistance(a, b) {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// ── js/domain/access-schedule.js
/**
 * domain/access-schedule · Horario en el que los trabajadores pueden usar el sistema.
 *
 * El administrador define los días y la franja horaria en «Gestión de Personal».
 * Fuera de ese horario un trabajador no puede ingresar aunque tenga usuario,
 * contraseña y código de verificación, y la sesión abierta se cierra sola al terminar.
 * El administrador no tiene restricción de horario.
 *
 * Sin backend la hora sale del reloj del dispositivo; cuando exista el servidor, esta
 * misma regla debe validarse allí con la hora del servidor.
 */

const DAY_LABELS = [
  { value: 1, short: 'L', name: 'lunes' },
  { value: 2, short: 'M', name: 'martes' },
  { value: 3, short: 'X', name: 'miércoles' },
  { value: 4, short: 'J', name: 'jueves' },
  { value: 5, short: 'V', name: 'viernes' },
  { value: 6, short: 'S', name: 'sábado' },
  { value: 0, short: 'D', name: 'domingo' },
];

const DEFAULT_ACCESS_SCHEDULE = { enabled: false, days: [1, 2, 3, 4, 5, 6], start: '06:00', end: '20:00' };

function minutes(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** ¿Está permitido el ingreso en este momento? Soporta franjas que cruzan la medianoche. */
function isWithinSchedule(schedule, now = new Date()) {
  if (!schedule?.enabled) return true;
  const start = minutes(schedule.start);
  const end = minutes(schedule.end);
  if (start === null || end === null || start === end) return true;
  const current = now.getHours() * 60 + now.getMinutes();
  const days = schedule.days || [];
  if (start < end) return days.includes(now.getDay()) && current >= start && current < end;
  // Franja nocturna (ej. 22:00 → 02:00): la parte de madrugada pertenece al día anterior.
  if (current >= start) return days.includes(now.getDay());
  if (current < end) return days.includes((now.getDay() + 6) % 7);
  return false;
}

/** Minutos que faltan para que termine la franja actual (null si no aplica). */
function minutesUntilClose(schedule, now = new Date()) {
  if (!schedule?.enabled || !isWithinSchedule(schedule, now)) return null;
  const end = minutes(schedule.end);
  const current = now.getHours() * 60 + now.getMinutes();
  return (end - current + 1440) % 1440 || 1440;
}

function formatTime12(hhmm) {
  const total = minutes(hhmm);
  if (total === null) return '—';
  const h = Math.floor(total / 60), m = total % 60;
  const suffix = h < 12 ? 'a. m.' : 'p. m.';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Resumen legible: «lunes a sábado, 6:00 a. m. – 8:00 p. m.». */
function describeSchedule(schedule) {
  if (!schedule?.enabled) return 'Sin restricción: los trabajadores pueden ingresar a cualquier hora.';
  const ordered = DAY_LABELS.filter(day => (schedule.days || []).includes(day.value));
  let days;
  if (!ordered.length) days = 'ningún día';
  else if (ordered.length === 7) days = 'todos los días';
  else {
    const idx = ordered.map(day => DAY_LABELS.indexOf(day));
    const consecutive = idx.every((value, i) => i === 0 || value === idx[i - 1] + 1);
    days = consecutive && ordered.length > 2 ? `${ordered[0].name} a ${ordered.at(-1).name}` : ordered.map(day => day.name).join(', ');
  }
  return `${days.charAt(0).toUpperCase()}${days.slice(1)}, ${formatTime12(schedule.start)} – ${formatTime12(schedule.end)}`;
}

// ── js/domain/accounting.js
/**
 * domain/accounting · Efectos contables de altas, cambios de ruta y cancelaciones
 * sobre la liquidación de cada ruta.
 */



function updateClientLoanAccounting(client, clientId, oldState, newState) {
  const oldRoute = routeSettlements[oldState.route];
  const newRoute = routeSettlements[newState.route];
  if (!newRoute) return;
  [oldRoute, newRoute].filter(Boolean).forEach(route => {
    route.loansEntered ||= [];
    route.loansNew ||= [];
  });
  const updateListRow = (route, listName, amount, remove = false) => {
    const list = route[listName];
    const index = list.findIndex(entry => entry.clientId === clientId);
    if (remove) {
      if (index >= 0) list.splice(index, 1);
    } else if (index >= 0) {
      list[index] = { ...list[index], name: client.name, amount };
    } else {
      list.unshift({ name: client.name, clientId, amount });
    }
  };
  const moved = oldState.route !== newState.route;
  if (moved && oldRoute) {
    oldRoute.loans = Math.max(0, Number(oldRoute.loans || 0) - oldState.principal);
    // Préstamo «sin afectar la base»: su capital también está en la base (new-client.js).
    if (client.noBaseImpact) oldRoute.base = Number(oldRoute.base || 0) - oldState.principal;
    updateListRow(oldRoute, 'loansEntered', 0, true);
    updateListRow(oldRoute, 'loansNew', 0, true);
    newRoute.loans = Number(newRoute.loans || 0) + newState.principal;
    if (client.noBaseImpact) newRoute.base = Number(newRoute.base || 0) + newState.principal;
    updateListRow(newRoute, 'loansEntered', newState.total);
    updateListRow(newRoute, 'loansNew', newState.principal);
    return;
  }
  const delta = newState.principal - oldState.principal;
  newRoute.loans = Math.max(0, Number(newRoute.loans || 0) + delta);
  if (client.noBaseImpact) newRoute.base = Number(newRoute.base || 0) + delta;
  updateListRow(newRoute, 'loansEntered', newState.total);
  updateListRow(newRoute, 'loansNew', newState.principal);
}

function addCancelledCard(client, clientId, date = localDateISO()) {
  const route = routeSettlements[client.route];
  if (!route) return;
  route.cardsCancelled ||= [];
  if (!route.cardsCancelled.some(item => item.clientId === clientId)) {
    route.cardsCancelled.unshift({ name: client.name, clientId, amount: client.total, date });
  }
}

/**
 * Una tarjeta (cartulina) solo cuenta como CANCELADA cuando la deuda quedó en cero.
 * Si el saldo vuelve a ser mayor que cero (p. ej. el admin corrige o elimina un abono),
 * se retira de la lista de canceladas de su ruta.
 */
function syncCancelledCard(client, clientId, date = localDateISO()) {
  if (!client) return;
  if (Number(client.balance) <= 0) { addCancelledCard(client, clientId, client.settledAt || date); return; }
  Object.values(routeSettlements).forEach(route => {
    if (route.cardsCancelled?.length) route.cardsCancelled = route.cardsCancelled.filter(entry => entry.clientId !== clientId);
  });
}

/** Limpia las listas: quita tarjetas cuyo cliente aún debe y agrega las saldadas que falten. */
function normalizeCancelledCards() {
  Object.values(routeSettlements).forEach(route => {
    route.cardsCancelled = (route.cardsCancelled || []).filter(entry => {
      const client = clients[entry.clientId];
      return !client || Number(client.balance) <= 0; // cliente eliminado: se conserva el registro histórico
    });
  });
  Object.entries(clients).forEach(([clientId, client]) => { if (Number(client.balance) <= 0) addCancelledCard(client, clientId, client.settledAt || localDateISO()); });
}

// ── js/domain/card-color.js
/**
 * domain/card-color · Color de cada cartulina, como en el sistema anterior.
 *
 * Las semanales se agrupan por el día de la semana en que pagan (el mismo día en que arrancó
 * el crédito); las quincenales y mensuales tienen su propio color. Se muestra como una franja
 * en el borde superior de la tarjeta (como la pestaña de una carpeta) con el día escrito.
 */

const WEEKDAY_COLORS = {
  1: { key: 'monday', label: 'Lunes', color: '#7e57c2', ink: '#fff' }, // morado
  2: { key: 'tuesday', label: 'Martes', color: '#ad1457', ink: '#fff' }, // rosado oscuro
  3: { key: 'wednesday', label: 'Miércoles', color: '#8a8f98', ink: '#111' }, // gris
  4: { key: 'thursday', label: 'Jueves', color: '#1e63d6', ink: '#fff' }, // azul
  5: { key: 'friday', label: 'Viernes', color: '#3eb489', ink: '#0b2a1f' }, // verde menta
  6: { key: 'saturday', label: 'Sábado', color: '#e53935', ink: '#fff' }, // rojo
};
const FREQUENCY_COLORS = {
  biweekly: { key: 'biweekly', label: 'Quincenal', color: '#f48fb1', ink: '#3b0a1e' }, // rosado
  monthly: { key: 'monthly', label: 'Mensual', color: '#89cff0', ink: '#0a2a3b' }, // azul bebé
};

/**
 * Color de la cartulina o null: canceladas (saldo en cero; si la persona saca otra cartulina,
 * la nueva sí lleva color), diarias, o semanales que arrancaron un domingo.
 */
function cardColor(client) {
  if (!client || Number(client.balance) <= 0) return null;
  if (FREQUENCY_COLORS[client.frequency]) return FREQUENCY_COLORS[client.frequency];
  if (client.frequency && client.frequency !== 'weekly') return null;
  const [year, month, day] = String(client.creditStartDate || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return WEEKDAY_COLORS[new Date(year, month - 1, day).getDay()] || null;
}

/** Pinta (o quita) la franja de color en `band`; `card` (opcional) recibe la clase y el color del borde. */
function paintCardColorBand(band, client, card = null) {
  const color = cardColor(client);
  band.hidden = !color;
  card?.classList.toggle('has-card-color', Boolean(color));
  if (!color) return;
  [band, card].forEach(node => {
    if (!node) return;
    node.dataset.cardColor = color.key;
    node.style.setProperty('--card-color', color.color);
    node.style.setProperty('--card-color-ink', color.ink);
  });
  band.textContent = color.label;
  band.title = color.key === 'biweekly' || color.key === 'monthly' ? `Cartulina ${color.label.toLocaleLowerCase('es')}` : `Cartulina semanal · paga los ${color.label.toLocaleLowerCase('es')}`;
}

/** Días de cobro que se pueden elegir (lunes a sábado), con su color. */
const PAYDAY_OPTIONS = Object.entries(WEEKDAY_COLORS).map(([weekday, color]) => ({ weekday: Number(weekday), ...color }));

const isoOf = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateOf = iso => { const [year, month, day] = String(iso).split('-').map(Number); return new Date(year, month - 1, day); };

/** Día de la semana (0 = domingo) de una fecha AAAA-MM-DD. */
function weekdayOf(iso) {
  return dateOf(iso).getDay();
}

/** La fecha `days` días después (o antes, si es negativo) de `fromISO`. */
function shiftDays(fromISO, days) {
  const date = dateOf(fromISO);
  date.setDate(date.getDate() + Number(days));
  return isoOf(date);
}

/** Próxima fecha (1 a 7 días después de `fromISO`) que cae en `weekday`. */
function nextWeekdayDate(fromISO, weekday) {
  const date = dateOf(fromISO);
  date.setDate(date.getDate() + (((Number(weekday) - date.getDay() + 6) % 7) + 1));
  return isoOf(date);
}

/** Fecha más cercana a `baseISO` (3 días antes a 3 después) que cae en `weekday`. */
function nearestWeekdayDate(baseISO, weekday) {
  const date = dateOf(baseISO);
  date.setDate(date.getDate() + ((Number(weekday) - date.getDay() + 10) % 7) - 3);
  return isoOf(date);
}

/**
 * Fecha de inicio para cobrar los `weekday`. Si la cartulina se entregó un domingo, el día
 * elegido es el siguiente a esa entrega (así se puede corregir sin que se corra una semana);
 * si no, se mueve al día más cercano a su inicio actual.
 */
function startDateForPayday(client, weekday) {
  if (client.deliveredOn && weekdayOf(client.deliveredOn) === 0) return nextWeekdayDate(client.deliveredOn, weekday);
  return nearestWeekdayDate(client.creditStartDate, weekday);
}

// ── js/domain/insurance.js
/**
 * domain/insurance · Seguros del crédito.
 *
 * Regla general: 10% del capital prestado. El trabajador (o el admin) puede cobrar
 * un valor distinto en pesos, siempre con un comentario que lo justifique. Los
 * seguros se cobran al entregar el préstamo, así que entran a la caja ese mismo día.
 */

const GENERAL_INSURANCE_PERCENT = 10;

function generalInsuranceAmount(principal) {
  return Math.round((Number(principal) || 0) * GENERAL_INSURANCE_PERCENT / 100);
}

/** Seguros de una cartulina, compatible con datos antiguos guardados en porcentaje. */
function clientInsurance(client) {
  const principal = Number(client?.principal) || 0;
  if (client && client.insuranceAmount != null) {
    return { amount: Number(client.insuranceAmount) || 0, custom: Boolean(client.insuranceCustom), reason: client.insuranceReason || '' };
  }
  if (client?.insurancePercent != null) {
    return { amount: Math.round(principal * Number(client.insurancePercent) / 100), custom: Number(client.insurancePercent) !== GENERAL_INSURANCE_PERCENT, reason: client.insuranceReason || '' };
  }
  return { amount: generalInsuranceAmount(principal), custom: false, reason: '' };
}

/**
 * Valida y normaliza lo que el usuario escribió.
 * @returns {{amount:number, custom:boolean, reason:string} | {error:string}}
 */
function resolveInsurance(principal, wantsCustom, rawAmount, rawReason) {
  const general = generalInsuranceAmount(principal);
  if (!wantsCustom) return { amount: general, custom: false, reason: '' };
  const amount = Math.round(Number(rawAmount));
  if (String(rawAmount ?? '').trim() === '' || !Number.isFinite(amount) || amount < 0) return { error: 'Escribe el valor de los seguros en pesos.' };
  if (amount > Number(principal)) return { error: 'Los seguros no pueden superar el monto del préstamo.' };
  if (amount === general) return { amount: general, custom: false, reason: '' };
  const reason = String(rawReason || '').trim();
  if (reason.length < 5) return { error: 'Explica por qué los seguros son diferentes al 10% general.' };
  return { amount, custom: true, reason };
}

/** Momento en que se cobraron los seguros (alta de la cartulina). */
function collectedTs(client, clientId) {
  if (client.insuranceCollectedTs) return Number(client.insuranceCollectedTs);
  const fromId = Number(String(clientId).match(/(\d{12,})/)?.[1]);
  return Number.isFinite(fromId) ? fromId : 0;
}

/**
 * Seguros cobrados en una cartulina en una fecha: los de la entrega y los de cada retanqueo
 * (`extraInsurance`). Las cartulinas migradas del sistema anterior no cuentan su seguro de
 * entrega (se cobró allá), pero sí los retanqueos hechos en EdgeCredit.
 */
function insuranceEntriesOf(client, clientId, dateISO) {
  const entries = [];
  if (client.insuranceCollectedAt === dateISO && !client.importedFrom) {
    entries.push({ date: dateISO, ts: collectedTs(client, clientId) || Date.now(), amount: Number(client.insuranceAmount) || 0 });
  }
  (client.extraInsurance || []).forEach(extra => {
    if (extra.date === dateISO && Number(extra.amount) > 0) entries.push({ date: dateISO, ts: Number(extra.ts) || Date.now(), amount: Number(extra.amount) });
  });
  return entries;
}

/**
 * Seguros cobrados en una ruta en la fecha indicada (cartulinas entregadas o retanqueadas ese día).
 * `sinceTs`: si el cobro ya se cerró hoy, solo cuenta lo cobrado después del cierre.
 */
function insuranceCollectedOn(clients, routeId, dateISO, sinceTs = 0) {
  return routeInsuranceEntries(clients, routeId, dateISO, sinceTs)
    .reduce((sum, entry) => ({ total: sum.total + entry.amount, count: sum.count + 1 }), { total: 0, count: 0 });
}

function routeInsuranceEntries(clients, routeId, dateISO, sinceTs) {
  return Object.entries(clients)
    .filter(([, client]) => client && client.route === routeId)
    .flatMap(([clientId, client]) => insuranceEntriesOf(client, clientId, dateISO))
    .filter(entry => !sinceTs || entry.ts > sinceTs);
}

/** Seguros cobrados en la fecha (aún sin cierre) como movimientos individuales con su hora. */
function liveInsuranceEntries(clients, routeId, dateISO, sinceTs = 0) {
  return routeInsuranceEntries(clients, routeId, dateISO, sinceTs).filter(entry => entry.amount > 0);
}

// ── js/domain/ledger.js
/**
 * domain/ledger · Libro diario de cada cobro (ruta) y caja del cobro.
 *
 * - `route.ledger[yyyy-mm-dd]` guarda los datos de cada día: base, cobro, préstamos,
 *   gastos, otros gastos, efectivo, salida de caja y seguros. Se escribe al cerrar el
 *   cobro («Verificar y cerrar ruta») y se puede corregir desde Reportes (gastos, otros
 *   gastos y salida de caja). Nada se borra: cualquier fecha se puede consultar después.
 * - El día de hoy, mientras no se cierre, se lee de los valores vivos de la ruta.
 * - `route.cashBox` es la CAJA del cobro: el monto de apertura (dinero disponible para
 *   prestar). No se reinicia nunca; cada día suma el cobro y resta préstamos, gastos,
 *   otros gastos y salidas de caja, y suma las ENTRADAS de caja (capital que se inyecta:
 *   `ledger[día].cashIn`, con su detalle en `route.cashEntries`). La apertura no se edita:
 *   un cobro sin apertura empieza en $0 y su capital inicial entra como una entrada.
 * - Solo se guardan los cierres de los últimos LEDGER_MONTHS_KEPT meses (pruneOldLedger):
 *   lo que movieron los días borrados queda sumado en la apertura, así la caja no cambia.
 * - `route.insuranceCuts` registra cada «Cuadrar seguros».
 * - Días traídos del sistema anterior (Excel): `cashAdjustment` es el ajuste de caja de ese
 *   día (descuadre entregado de más o de menos, o un ingreso de capital) para que la caja
 *   quede igual a la del Excel. Lo explica `adjustmentNote`. Los días de EdgeCredit no lo usan.
 */



const DAY_FIELDS = ['base', 'collections', 'loans', 'expenses', 'otherExpenses', 'cashDelivered', 'cashOut', 'cashIn', 'insurance'];
const LIVE_FIELDS = ['base', 'collections', 'loans', 'expenses', 'otherExpenses', 'cashDelivered'];
const EDITABLE_FIELDS = ['expenses', 'otherExpenses', 'cashOut'];

function ensureLedger(route) {
  if (!route) return route;
  route.ledger ||= {};
  route.cashBox ||= { opening: 0, openingDate: null };
  route.insuranceCuts ||= [];
  route.cashEntries ||= [];
  return route;
}

function closedToday(route) {
  return route.lastClosure?.date === localDateISO();
}

/**
 * Datos de un día. Hoy sin cerrar = valores vivos de la ruta (+ salida de caja anotada).
 * `otherExpenses` incluye el sueldo del trabajador que anotó el admin (`salary`): lo paga la
 * caja del cobro, pero no hace parte de lo que entrega el trabajador (no genera descuadre).
 */
function dayRecord(route, dateISO, liveInsurance = 0) {
  ensureLedger(route);
  const stored = route.ledger[dateISO];
  const today = localDateISO();
  const salary = Number(stored?.salary || 0);
  if (dateISO === today && !closedToday(route)) {
    const live = Object.fromEntries(LIVE_FIELDS.map(field => [field, Number(route[field] || 0)]));
    return { ...live, otherExpenses: live.otherExpenses + salary, salary, cashOut: Number(stored?.cashOut || 0), cashIn: Number(stored?.cashIn || 0), insurance: liveInsurance, closed: false, live: true };
  }
  if (!stored) return { ...Object.fromEntries(DAY_FIELDS.map(field => [field, 0])), salary: 0, closed: false, empty: true };
  const record = Object.fromEntries(DAY_FIELDS.map(field => [field, Number(stored[field] || 0)]));
  return {
    ...record, otherExpenses: record.otherExpenses + salary, salary,
    cashAdjustment: Number(stored.cashAdjustment || 0), adjustmentNote: stored.adjustmentNote || '',
    closed: Boolean(stored.closed), demo: Boolean(stored.demo),
  };
}

/** Descuadre del día (fórmula de la liquidación). Solo aplica a días cerrados; el sueldo no cuenta. */
function ledgerDifference(record) {
  if (!record.closed) return null;
  return record.collections + record.base - record.loans - record.expenses - (record.otherExpenses - Number(record.salary || 0)) - record.cashDelivered;
}

/** Movimiento de la caja del cobro en un día. */
function cashBoxMovement(record) {
  return record.collections - record.loans - record.expenses - record.otherExpenses - record.cashOut + Number(record.cashIn || 0) + Number(record.cashAdjustment || 0);
}

/** Caja al cierre del día indicado (incluye hoy en vivo si la fecha llega a hoy). */
function cashBoxAt(route, dateISO, liveInsurance = 0) {
  ensureLedger(route);
  const { opening, openingDate } = route.cashBox;
  if (openingDate && dateISO < openingDate) return null; // sin apertura: desde el primer cierre, en $0
  const today = localDateISO();
  let total = Number(opening || 0);
  Object.keys(route.ledger).forEach(date => {
    if ((openingDate && date < openingDate) || date > dateISO) return;
    if (date === today && !closedToday(route)) return; // hoy se suma en vivo abajo
    total += cashBoxMovement(dayRecord(route, date));
  });
  if ((!openingDate || today >= openingDate) && today <= dateISO && !closedToday(route)) total += cashBoxMovement(dayRecord(route, today, liveInsurance));
  return total;
}

const LEDGER_MONTHS_KEPT = 4;

/** Primer día que se conserva: el mismo día de hace 4 meses (24-oct → 24-jun). */
function ledgerCutoff(today = localDateISO()) {
  const [year, month, day] = today.split('-').map(Number);
  const lastDay = new Date(year, month - 1 - LEDGER_MONTHS_KEPT + 1, 0).getDate();
  return localDateISO(new Date(year, month - 1 - LEDGER_MONTHS_KEPT, Math.min(day, lastDay)));
}

/**
 * Borra los cierres de más de 4 meses. Lo que movieron esos días pasa a la apertura y la
 * apertura se corre a la fecha de corte: la caja de hoy (y la de los días que quedan) no
 * cambia. Devuelve true si borró algo.
 */
function pruneOldLedger(route, today = localDateISO()) {
  ensureLedger(route);
  const cutoff = ledgerCutoff(today);
  const old = Object.keys(route.ledger).filter(date => date < cutoff).sort();
  if (!old.length) return false;
  const { openingDate } = route.cashBox;
  if (!openingDate || openingDate < cutoff) {
    const opening = old.filter(date => !openingDate || date >= openingDate)
      .reduce((total, date) => total + cashBoxMovement(dayRecord(route, date)), Number(openingDate ? route.cashBox.opening || 0 : 0));
    route.cashBox = { ...route.cashBox, opening, openingDate: cutoff, prunedBefore: cutoff };
  }
  old.forEach(date => { delete route.ledger[date]; });
  route.cashEntries = route.cashEntries.filter(entry => entry.date >= cutoff);
  Object.entries(route.weeklySalaries || {}).forEach(([week, salary]) => { if (salary.date < cutoff) delete route.weeklySalaries[week]; });
  return true;
}

/**
 * Entrada de caja: capital que se inyecta al cobro (o el capital con que se abre un cobro
 * nuevo). Suma a la caja ese día y queda el detalle de quién, cuándo y por qué.
 */
function addCashEntry(route, amount, { date = localDateISO(), by = 'Administrador', note = '' } = {}) {
  ensureLedger(route);
  const value = Math.round(Number(amount) || 0);
  if (value <= 0) return null;
  route.ledger[date] ||= { closed: false };
  route.ledger[date].cashIn = Number(route.ledger[date].cashIn || 0) + value;
  const entry = { id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, date, amount: value, by, note: String(note || '').trim(), ts: Date.now() };
  route.cashEntries.push(entry);
  return entry;
}

/** Guarda el día al cerrar el cobro (antes de reiniciar los valores vivos). */
function recordClosure(route, dateISO, values, closedTs) {
  ensureLedger(route);
  const previous = route.ledger[dateISO] || {};
  route.ledger[dateISO] = {
    ...previous,
    ...Object.fromEntries(LIVE_FIELDS.map(field => [field, Number(values[field] || 0)])),
    insurance: Number(previous.closed ? previous.insurance || 0 : 0) + Number(values.insurance || 0),
    cashOut: Number(previous.cashOut || 0),
    // Abonos del día recibidos por transferencia: no pasan a la base del día siguiente.
    transfers: Number(values.transfers || 0),
    closed: true,
    closedTs,
    demo: false,
  };
}

/** Efectivo con que terminó un día cerrado: el entregado o, si no se anotó, el calculado. */
function closedDayCash(record) {
  const computed = record.collections + record.base - record.loans - record.expenses - (record.otherExpenses - Number(record.salary || 0));
  return Number(record.cashDelivered || 0) > 0 ? Number(record.cashDelivered) : Math.max(0, computed);
}

/**
 * Base que le toca hoy a la ruta: el efectivo del último día cerrado antes de hoy (sirve
 * también para los días traídos del Excel), sin los abonos de ese día que llegaron por
 * transferencia: esa plata está en el banco, no en la mano del trabajador. Si ese día fue
 * sábado el efectivo se entregó y la base arranca en 0 (o en la base para el lunes que el
 * admin asignó ese sábado), igual que al cerrar en Liquidación.
 * `transfersOn(fecha)` da las transferencias de un cierre que no las guardó. Devuelve null
 * sin cierres previos.
 */
function carriedBase(route, today = localDateISO(), transfersOn = () => 0) {
  ensureLedger(route);
  const last = Object.keys(route.ledger).filter(date => date < today && route.ledger[date]?.closed).sort().at(-1);
  if (!last) return null;
  const [year, month, day] = last.split('-').map(Number);
  const saturday = new Date(year, month - 1, day).getDay() === 6;
  const stored = route.ledger[last].transfers;
  const transfers = Number(stored ?? transfersOn(last)) || 0;
  const amount = saturday ? mondayBaseFor(route, last) : Math.max(0, closedDayCash(dayRecord(route, last)) - transfers);
  return { date: last, amount, transfers, saturday };
}

/**
 * Base para el lunes que el admin dejó asignada el sábado `saturdayISO` (0 si no dejó ninguna).
 * Es la única forma de que un trabajador empiece la semana con base.
 */
function mondayBaseFor(route, saturdayISO) {
  return route?.mondayBase?.date === saturdayISO ? Math.max(0, Number(route.mondayBase.amount) || 0) : 0;
}

/**
 * Comentario de «otros gastos» de un día: el que dejó el admin o, si no lo ha cambiado, lo que
 * anotó el trabajador al registrar cada gasto («Pinchada ($ 12.000)»). El sueldo va aparte (daySalary).
 */
function otherExpensesNote(route, dateISO) {
  ensureLedger(route);
  const stored = route.ledger[dateISO]?.otherExpensesNote;
  if (typeof stored === 'string') return stored;
  return (route.otherExpenseEntries || [])
    .filter(entry => (entry.date || String(entry.createdAt || '').slice(0, 10)) === dateISO)
    .map(entry => `${entry.note || 'Sin descripción'} (${formatMoney(entry.amount)})`)
    .join('\n');
}

function setOtherExpensesNote(route, dateISO, text) {
  ensureLedger(route);
  route.ledger[dateISO] ||= { closed: false };
  route.ledger[dateISO].otherExpensesNote = String(text || '').trim();
}

/** Comentario de la salida de caja de un día (a dónde o para qué salió la plata). */
function cashOutNote(route, dateISO) {
  ensureLedger(route);
  return String(route.ledger[dateISO]?.cashOutNote || '');
}

function setCashOutNote(route, dateISO, text) {
  ensureLedger(route);
  route.ledger[dateISO] ||= { closed: false };
  route.ledger[dateISO].cashOutNote = String(text || '').trim();
}

/** Sueldo del trabajador anotado ese día (ya está sumado en «otros gastos»). */
function daySalary(route, dateISO) {
  ensureLedger(route);
  return Number(route.ledger[dateISO]?.salary || 0);
}

/**
 * Sueldo de la semana que empieza en `weekFrom`. Queda en el día `dateISO` (el sábado, o hoy
 * si la semana va en curso) y se ve sumado a «otros gastos» de ese día (dayRecord). Al
 * cambiarlo se reemplaza en el mismo día. Devuelve la fecha donde quedó.
 */
function setWeekSalary(route, weekFrom, dateISO, amount) {
  ensureLedger(route);
  route.weeklySalaries ||= {};
  const previous = route.weeklySalaries[weekFrom];
  const date = previous?.date || dateISO;
  const value = Math.max(0, Math.round(Number(amount) || 0));
  route.ledger[date] ||= { closed: false };
  route.ledger[date].salary = value;
  if (value) route.weeklySalaries[weekFrom] = { amount: value, date };
  else delete route.weeklySalaries[weekFrom];
  return date;
}

/** Corrige gastos, otros gastos o salida de caja de un día. Hoy sin cerrar: va a la ruta viva. */
function setDayField(route, dateISO, field, value) {
  if (!EDITABLE_FIELDS.includes(field)) return;
  ensureLedger(route);
  // En la tabla «otros gastos» se ve con el sueldo incluido: se guarda sin él.
  const salary = field === 'otherExpenses' ? Number(route.ledger[dateISO]?.salary || 0) : 0;
  const amount = Math.max(0, Math.round(Number(value) || 0) - salary);
  if (dateISO === localDateISO() && !closedToday(route) && field !== 'cashOut') {
    route[field] = amount;
    return;
  }
  route.ledger[dateISO] ||= { closed: false };
  route.ledger[dateISO][field] = amount;
  if (route.ledger[dateISO].demo) route.ledger[dateISO].edited = true;
}

// ── Seguros: entradas por día y cortes («Cuadrar seguros») ──

function monthStartTs(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month - 1, 1).getTime();
}

function monthEndTs(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month, 1).getTime() - 1;
}

/**
 * Seguros del día como movimientos con hora: los días cerrados toman la hora del
 * cierre; hoy (en vivo) toma la hora de cada alta.
 */
function insuranceEntries(route, liveEntries = []) {
  ensureLedger(route);
  const entries = Object.entries(route.ledger)
    .filter(([, record]) => Number(record.insurance) > 0)
    .map(([date, record]) => ({ date, ts: Number(record.closedTs) || new Date(`${date}T19:00:00`).getTime(), amount: Number(record.insurance) }));
  return entries.concat(liveEntries).sort((a, b) => a.ts - b.ts);
}

/** Fin del periodo de seguros de un mes: el último cuadre hecho en ese mes o, si no hubo, fin de mes. */
function periodEnd(route, monthValue) {
  const start = monthStartTs(monthValue);
  const end = monthEndTs(monthValue);
  const cuts = route.insuranceCuts.filter(cut => cut.ts >= start && cut.ts <= end);
  return cuts.length ? Math.max(...cuts.map(cut => cut.ts)) : end;
}

function previousMonth(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Bolsa de seguros del mes. Empieza donde terminó la del mes anterior: si el mes anterior
 * se cuadró antes de fin de mes, lo cobrado después de ese cuadre pasa a este mes.
 */
function insurancePeriod(route, monthValue, liveEntries = []) {
  ensureLedger(route);
  const from = periodEnd(route, previousMonth(monthValue));
  const to = periodEnd(route, monthValue);
  const all = insuranceEntries(route, liveEntries);
  const inPeriod = all.filter(entry => entry.ts > from && entry.ts <= to);
  const start = monthStartTs(monthValue);
  const carried = inPeriod.filter(entry => entry.ts < start).reduce((sum, entry) => sum + entry.amount, 0);
  const total = inPeriod.reduce((sum, entry) => sum + entry.amount, 0);
  const cuts = route.insuranceCuts.filter(cut => cut.ts >= start && cut.ts <= monthEndTs(monthValue)).sort((a, b) => a.ts - b.ts);
  const lastCut = cuts.at(-1) || null;
  // Lo cobrado en este mes después del último cuadre pasa al mes siguiente.
  const rollover = lastCut ? all.filter(entry => entry.ts > lastCut.ts && entry.ts <= monthEndTs(monthValue)).reduce((sum, entry) => sum + entry.amount, 0) : 0;
  return { entries: inPeriod, total, carried, cuts, lastCut, rollover, from, to };
}

function monthOf(ts) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Seguros que se cuadrarían en el instante `cutTs`: lo cobrado desde el límite anterior
 * (fin del periodo del mes previo o el último cuadre antes de ese instante).
 */
function insuranceDueAt(route, cutTs, liveEntries = []) {
  ensureLedger(route);
  const since = Math.max(
    periodEnd(route, previousMonth(monthOf(cutTs))),
    ...route.insuranceCuts.filter(cut => cut.ts < cutTs && monthOf(cut.ts) === monthOf(cutTs)).map(cut => cut.ts),
  );
  return insuranceEntries(route, liveEntries).filter(entry => entry.ts > since && entry.ts <= cutTs).reduce((sum, entry) => sum + entry.amount, 0);
}

/** Quita el último cuadre del mes indicado (solo en modo de prueba). */
function undoLastInsuranceCut(route, monthValue) {
  ensureLedger(route);
  const cuts = route.insuranceCuts.filter(cut => monthOf(cut.ts) === monthValue).sort((a, b) => a.ts - b.ts);
  const last = cuts.at(-1);
  if (!last) return null;
  route.insuranceCuts = route.insuranceCuts.filter(cut => cut !== last);
  return last;
}

/** Registra un cuadre de seguros ahora. */
function cutInsurance(route, amount, by = 'Administrador', ts = Date.now()) {
  ensureLedger(route);
  const cut = { ts, date: localDateISO(new Date(ts)), amount: Math.round(Number(amount) || 0), by };
  route.insuranceCuts.push(cut);
  return cut;
}

/**
 * Último «Verificar y cerrar ruta»: fecha del día cerrado y momento del cierre (0 si no se
 * sabe, p. ej. días traídos del Excel). Null si la ruta nunca se ha cerrado.
 */
function closureCutoff(route) {
  ensureLedger(route);
  const closure = route.lastClosure?.date ? { date: route.lastClosure.date, ts: Date.parse(route.lastClosure.submittedAt) || 0 } : null;
  const lastClosed = Object.keys(route.ledger).filter(date => route.ledger[date]?.closed).sort().at(-1);
  if (lastClosed && (!closure || lastClosed > closure.date)) return { date: lastClosed, ts: Number(route.ledger[lastClosed].closedTs) || 0 };
  return closure;
}

/**
 * ¿El abono sigue pendiente de cierre? Son los registrados después del último cierre, aunque
 * sean de días anteriores en que no se cerró la ruta: esos suman en el cobro hasta que se cierre.
 * Los del mismo día del cierre sin hora (`at`) se toman como anteriores al cierre.
 */
function isPendingPayment(payment, cutoff, today = localDateISO()) {
  if (!payment || !(Number(payment.amount) > 0) || payment.date > today) return false;
  if (!cutoff || payment.date > cutoff.date) return true;
  return payment.date === cutoff.date && Boolean(cutoff.ts) && Boolean(payment.at) && Date.parse(payment.at) > cutoff.ts;
}

/** Abonos de la ruta pendientes de cierre ({ clientId, client, payment }), del más reciente al más antiguo. */
function pendingRoutePayments(clientsById, routeId, route) {
  const cutoff = route ? closureCutoff(route) : null;
  const today = localDateISO();
  return Object.entries(clientsById)
    .filter(([, client]) => client?.route === routeId)
    .flatMap(([clientId, client]) => (client.payments || [])
      .filter(payment => isPendingPayment(payment, cutoff, today))
      .map(payment => ({ clientId, client, payment })))
    .sort((a, b) => String(b.payment.at || `${b.payment.date}T00`).localeCompare(String(a.payment.at || `${a.payment.date}T00`)));
}

/** Fecha y hora en que se registró un abono: «dom 26 oct · 3:05 p. m.» (sin hora si no se guardó). */
function paymentStamp(payment) {
  const day = new Date(`${payment.date}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '').replace(' de ', ' ');
  const time = payment.at ? new Date(payment.at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  return [day, time].filter(Boolean).join(' · ');
}

// ── js/domain/legacy-import.js
/**
 * domain/legacy-import · Convierte la exportación del sistema anterior (CREDITOS.exe,
 * base Access ca.mdb) en cartulinas de EdgeCredit. Función pura: no toca el DOM ni guarda.
 *
 * Entrada: el JSON que genera tools/migracion/exportar-cobro.ps1
 *   { cobro: {COB_CODIGO, COB_NOMBRE…}, tarjetas: [{ …TARGETA, cliente: {…CLIENTES}, abonos: [{…DESCRIPCION}] }] }
 * Todos los campos llegan como texto (así los guarda Access en ese sistema).
 *
 * Reglas acordadas para la migración:
 *  - PRES viene en miles; TAR_VALOR, TAR_CUOTA, TSALDO y DES_ABONO en pesos.
 *  - La fecha del abono sale de FECHA_ACT (parte antes de «->») o de `captura`.
 *    DES_FECHA NO se usa: es una fecha consecutiva ficticia.
 *  - Todos los abonos entran como efectivo (el sistema anterior no lo registraba).
 *  - Seguro: 10 % general, ya cobrado en el sistema anterior (no entra a la caja de hoy).
 *  - La cédula se toma tal cual, sin los prefijos A/B ni el sufijo -1 que el sistema
 *    agregaba por cada crédito de la misma persona.
 *  - CLAVO deja la cartulina con advertencia de pago y una nota.
 */






const LEGACY_FREQUENCY = { S: 'weekly', Q: 'biweekly', M: 'monthly', D: 'daily' };
const LEGACY_MONTHS = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };
const NOTES_LIMIT = 1000;

const legacyText = value => String(value ?? '').trim();

/** «600000», «600.000», «$ 600.000», «167200,00» → número en pesos (NaN si no es número). */
function legacyNumber(value) {
  let text = legacyText(value).replace(/[$\s]/g, '');
  if (!text) return NaN;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '');
  else text = text.replace(',', '.');
  return Number(text);
}

/**
 * Fechas del sistema anterior → yyyy-mm-dd (o '' si no se entiende):
 * «28-03-25», «13-oct-26», «13-oct-26->150», «13/10/2026», «2026-10-13».
 */
function legacyDate(value) {
  const text = legacyText(value).split('->')[0].trim().toLocaleLowerCase('es');
  if (!text) return '';
  let day; let month; let year;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [, year, month, day] = match.map(Number);
  else if ((match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/))) [, day, month, year] = match.map(Number);
  else if ((match = text.match(/^(\d{1,2})[-/. ]([a-zñ]{3})[a-zñ]*\.?[-/. ](\d{2}|\d{4})\b/))) {
    day = Number(match[1]); month = LEGACY_MONTHS[match[2]]; year = Number(match[3]);
  } else return '';
  if (year < 100) year += 2000;
  const date = new Date(year, month - 1, day);
  if (!month || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return localDateISO(date);
}

/** Cédula sin las marcas del sistema anterior: «A1036…», «B1036…», «1036…-1» → «1036…». */
function legacyIdNumber(value) {
  return legacyText(value).replace(/^[AB](?=\d)/i, '').replace(/-\d+$/, '');
}

const legacyFlag = value => { const text = legacyText(value).toUpperCase(); return Boolean(text) && !['0', 'NO', 'N', 'FALSE', 'FALSO'].includes(text); };

function legacyInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}

/** Abonos de una tarjeta con fecha real. Los que no tienen fecha toman la del abono anterior. */
function legacyPayments(card, warnings) {
  let previousDate = '';
  return (card.abonos || []).map(row => {
    const amount = Math.round(legacyNumber(row.DES_ABONO));
    let date = legacyDate(row.FECHA_ACT) || legacyDate(row.captura ?? row.CAPTURA);
    if (!date) {
      date = previousDate || legacyDate(card.TAR_FECHA);
      warnings.push(`Abono de ${formatMoney(amount || 0)} sin fecha registrada: se tomó ${date || 'la fecha de inicio'}.`);
    }
    previousDate = date;
    return { date, amount };
  }).filter(payment => {
    if (Number.isFinite(payment.amount) && payment.amount > 0) return true;
    if (payment.amount !== 0) warnings.push('Se omitió un abono con valor no válido.');
    return false;
  });
}

/** Convierte una tarjeta (crédito) del sistema anterior. Devuelve { code, clientId, client, warnings } o { code, error }. */
function convertLegacyCard(card, routeId, importedAt, correction = {}) {
  const code = legacyText(card.TAR_CODIGO);
  const person = card.cliente || {};
  const warnings = [];
  const principal = Math.round(legacyNumber(card.PRES) * 1000);
  const total = Math.round(legacyNumber(card.TAR_VALOR));
  const installment = Math.round(legacyNumber(card.TAR_CUOTA));
  const totalDays = Math.round(legacyNumber(card.TIEMPO));
  const balance = Math.round(legacyNumber(card.TSALDO));
  const creditStartDate = legacyDate(card.TAR_FECHA);
  const frequency = LEGACY_FREQUENCY[legacyText(card.FP).toUpperCase()];
  const legacyName = legacyText(person.CLI_NOMBRE);
  const name = legacyText(correction.name) || legacyName;
  const reference = legacyText(correction.reference);
  if (!code) return { code: '(sin código)', error: 'La tarjeta no tiene código.' };
  if (!legacyName) return { code, error: 'No se encontró el cliente de la tarjeta.' };
  if (!(principal > 0) || !(total > 0)) return { code, error: 'Capital o total no válidos.' };
  if (!(installment > 0) || !(totalDays > 0)) return { code, error: 'Cuota o plazo no válidos.' };
  if (!creditStartDate) return { code, error: `Fecha de inicio no válida (${legacyText(card.TAR_FECHA) || 'vacía'}).` };
  if (!frequency) return { code, error: `Frecuencia de pago desconocida (${legacyText(card.FP) || 'vacía'}).` };
  if (!Number.isFinite(balance)) return { code, error: 'Saldo no válido.' };
  if (balance <= 0) return { code, error: 'El crédito ya no tiene saldo: no se importa como activo.' };

  const payments = legacyPayments(card, warnings);
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (total - paidAmount !== balance) warnings.push(`El saldo del sistema (${formatMoney(balance)}) no cuadra con total − abonos (${formatMoney(total - paidAmount)}). Se usa el saldo del sistema.`);
  const idNumber = legacyIdNumber(person.CLI_CODIGO);
  const phone = legacyText(person.CLI_BARRIO);
  const address = [legacyText(person.CLI_CALLE), legacyText(person.CLI_CIUDAD)].filter(Boolean).join(', ');
  if (!idNumber) warnings.push('Sin cédula.');
  if (!phone) warnings.push('Sin teléfono.');
  if (!address) warnings.push('Sin dirección.');
  const interestPercent = Math.round((total / principal - 1) * 1000) / 10;
  if (interestPercent !== 20) warnings.push(`Interés de ${interestPercent} % (lo normal es 20 %).`);
  const clavo = legacyFlag(card.CLAVO);
  const rating = legacyText(card.TOTRO).toUpperCase();

  const installments = Math.max(1, Math.ceil(total / installment));
  const insuranceAmount = generalInsuranceAmount(principal);
  const client = {
    name, initials: legacyInitials(name), route: routeId, balance, principal, installment,
    status: 'Al día', late: false, id: idNumber, address, altAddress: '', addressHistory: [], phone,
    total, term: `${totalDays} días`, breakdown: `${formatMoney(principal)} / ${formatMoney(total - principal)}`,
    paid: 0, installments, progress: 0, routeDay: 1, totalDays, generalInterest: 0,
    interestPercent, insurancePercent: null, insuranceAmount, insuranceCustom: false, insuranceReason: 'Cobrado en el sistema anterior',
    insuranceCollectedAt: creditStartDate, insuranceCollectedTs: localDate(creditStartDate).getTime(),
    addressNotes: '', notes: '', notesUpdatedAt: null, notesUpdatedBy: null, payments: [], interestHistory: [], noBaseImpact: true,
    frequency, creditStartDate, visitHistory: [], paymentWarning: clavo, paidPeriodIndexes: [], schedulePaidBaseline: 0,
    photoData: '', totalPaidAmount: paidAmount, settledAt: null,
    importedFrom: { system: 'CREDITOS', code, personCode: legacyText(person.CLI_CODIGO), importedAt },
  };
  if (clavo) client.worstHistory = 'irregular';
  client.payments = payments
    .map(payment => ({ date: payment.date, amount: payment.amount, method: 'cash', cycleIndex: paymentCycleIndex(client, payment.date), receiptName: '', receiptData: '', imported: true }))
    .sort((a, b) => b.date.localeCompare(a.date));
  client.paidPeriodIndexes = [...new Set(client.payments.map(payment => payment.cycleIndex))].sort((a, b) => a - b);
  // Cuotas cubiertas según lo abonado: así el atraso se mide por plata pagada, aunque
  // en el sistema anterior un abono cubriera varias cuotas o media cuota.
  client.schedulePaidBaseline = Math.min(installments, Math.floor(paidAmount / installment));
  client.paid = client.schedulePaidBaseline;
  client.progress = Math.min(100, Math.round(paidAmount / total * 100));

  const notes = [`Migrado del sistema anterior (crédito ${code}).`];
  if (name !== legacyName) notes.push(`Nombre en el sistema anterior: ${legacyName}.`);
  if (reference) notes.push(`Referencia: ${reference}.`);
  if (rating) notes.push(`Calificación anterior: ${rating}.`);
  if (clavo) notes.push('CLAVO (mora) en el sistema anterior.');
  const history = [legacyText(person.ESTADO2), legacyText(card.DATOS)].filter(Boolean).join(' · ');
  if (history) notes.push(`Historial anterior: ${history}`);
  client.notes = notes.join('\n').slice(0, NOTES_LIMIT);
  client.notesUpdatedAt = importedAt;
  client.notesUpdatedBy = 'Migración';
  return { code, legacyName, reference, clientId: `legacy-${code.toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '-')}`, client, warnings };
}

/**
 * La primera versión del script de exportación dejaba cada lista dentro de otra lista
 * ([[…]]) y, en lo más profundo, PowerShell convertía los abonos en texto («@{DES_ABONO=…}»).
 * Se aceptan las listas anidadas; el texto no, porque ya no se pueden leer los valores.
 */
function legacyRow(value) {
  const rows = (Array.isArray(value) ? value.flat(Infinity) : [value]).filter(item => item != null);
  if (rows.some(item => typeof item === 'string' && item.startsWith('@{'))) {
    throw new Error('El archivo se generó con la versión anterior del script y le faltan datos. Descarga de nuevo exportar-cobro.ps1 y vuelve a exportar.');
  }
  return rows.find(item => typeof item === 'object') || null;
}

function legacyCardRows(card) {
  const abonos = (Array.isArray(card?.abonos) ? card.abonos.flat(Infinity) : [card?.abonos]).filter(item => item != null);
  if (abonos.some(item => typeof item !== 'object')) legacyRow(abonos);
  return { ...card, cliente: legacyRow(card?.cliente), abonos: abonos.filter(item => typeof item === 'object') };
}

/**
 * Archivo de correcciones de nombres (se prepara aparte y NO se guarda en el repositorio):
 *   { "tipo": "edgecredit-correcciones", "cobro": "DONMATIAS",
 *     "creditos": { "DONMATIAS22": { "nombre": "Juan Carlos Gutierrez", "referencia": "Policía" } } }
 * Devuelve { DONMATIAS22: { name, reference } }.
 */
function legacyCorrections(raw) {
  if (!raw || raw.tipo !== 'edgecredit-correcciones' || typeof raw.creditos !== 'object') {
    throw new Error('No es un archivo de correcciones de EdgeCredit.');
  }
  return Object.fromEntries(Object.entries(raw.creditos).map(([code, item]) => [
    legacyText(code).toUpperCase(), { name: legacyText(item?.nombre), reference: legacyText(item?.referencia) },
  ]));
}

/**
 * Convierte la exportación completa de un cobro.
 * `corrections`: { CODIGO: { name, reference } } con el nombre limpio y la referencia que
 * el sistema anterior pegaba al nombre (oficio, ciudad, quién lo recomendó).
 * @returns {{ cobro:string, worker:string, cards:Array, rejected:Array, totals:{count,people,principal,total,balance,paid,payments} }}
 */
function convertLegacyExport(raw, routeId, importedAt = new Date().toISOString(), corrections = {}) {
  if (!raw || !Array.isArray(raw.tarjetas)) throw new Error('El archivo no es una exportación del sistema anterior (falta la lista «tarjetas»).');
  const tarjetas = raw.tarjetas.map(legacyCardRows);
  const results = tarjetas.map(card => convertLegacyCard(card, routeId, importedAt, corrections[legacyText(card?.TAR_CODIGO).toUpperCase()]));
  const cards = results.filter(result => result.client);
  const rejected = results.filter(result => result.error);
  const totals = cards.reduce((sum, { client }) => ({
    count: sum.count + 1,
    principal: sum.principal + client.principal,
    total: sum.total + client.total,
    balance: sum.balance + client.balance,
    paid: sum.paid + client.totalPaidAmount,
    payments: sum.payments + client.payments.length,
  }), { count: 0, principal: 0, total: 0, balance: 0, paid: 0, payments: 0 });
  totals.people = new Set(cards.map(({ client }) => personKey(client.id) || client.name)).size;
  const cobro = legacyRow(raw.cobro) || {};
  return { cobro: legacyText(cobro.COB_CODIGO), worker: legacyText(cobro.COB_NOMBRE), cards, rejected, totals };
}

// ── js/domain/loan-schedule.js
/**
 * domain/loan-schedule · Reglas del crédito: ciclos de pago, vencimientos,
 * comportamiento de pago y archivado de historiales. Sin acceso al DOM.
 */





function inferClientPrincipal(client) {
  if (Number.isFinite(Number(client.principal)) && Number(client.principal) > 0) return Number(client.principal);
  const stated = String(client.breakdown || '').split('/')[0].match(/[\d.]+/);
  if (stated) return Number(stated[0].replace(/\./g, ''));
  return Math.round(Number(client.total || 0) / (1 + Number(client.interestPercent ?? 20) / 100));
}

function pruneExpiredPaymentHistories() {
  let changed = false;
  Object.values(clients).forEach(client => {
    client.payments ||= [];
    if (client.totalPaidAmount == null) client.totalPaidAmount = client.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    if (Number(client.balance) <= 0) {
      if (!client.settledAt) { client.settledAt = localDateISO(); changed = true; }
      if (dayDifference(client.settledAt, localDateISO()) >= 7 && client.payments.length) {
        client.totalPaidAmount = client.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
        client.payments = [];
        client.archivedPaymentsAt = localDateISO();
        changed = true;
      }
    } else if (client.settledAt) { client.settledAt = null; changed = true; }
  });
  if (changed && typeof persistBusinessData === 'function') persistBusinessData();
}

/**
 * Saldo que quedó después de cada abono (mismo orden que client.payments), como el
 * historial del sistema anterior: «23-oct → 200 · saldo 200.000». Se reconstruye desde el
 * saldo actual sumando los abonos posteriores y restando lo que se agregó después
 * (intereses, financiación y retanqueos). Los abonos de un mismo día se toman en el orden
 * de la lista (el primero es el más reciente).
 */
function balancesAfterPayments(client) {
  const payments = client.payments || [];
  const additions = [
    ...(client.interestHistory || []).map(entry => ({ date: entry.date, amount: Number(entry.amount) || 0 })),
    ...(client.restructures || []).filter(entry => entry.type === 'retanqueo').map(entry => ({ date: entry.date, amount: (Number(entry.extra) || 0) + (Number(entry.interest) || 0) })),
  ];
  const balance = Math.max(0, Number(client.balance) || 0);
  return payments.map((payment, index) => {
    const laterPaid = payments.reduce((sum, other, otherIndex) => {
      const later = other.date > payment.date || (other.date === payment.date && otherIndex < index);
      return later ? sum + (Number(other.amount) || 0) : sum;
    }, 0);
    const laterAdded = additions.reduce((sum, entry) => (entry.date >= payment.date ? sum + entry.amount : sum), 0);
    return Math.max(0, balance + laterPaid - laterAdded);
  });
}

function updatePaidAmountTotal(client) {
  client.totalPaidAmount = (client.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

/** Porcentaje pagado de la cartulina (abonado / abonado + saldo), el mismo del anillo de la ficha. */
function paidPercent(client) {
  const totalPaid = Math.max(0, Number(client.totalPaidAmount ?? (client.payments || []).reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) || 0), 0)));
  const outstanding = Math.max(0, Number(client.balance) || 0);
  return totalPaid + outstanding > 0 ? Math.min(100, Math.round(totalPaid / (totalPaid + outstanding) * 100)) : 100;
}

function normalizeClientSchedules() {
  const today = new Date();
  Object.values(clients).forEach(client => {
    if (!paymentFrequencyDays[client.frequency]) client.frequency = 'weekly';
    if (!client.creditStartDate) {
      const started = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      started.setDate(started.getDate() - Math.max(0, Number(client.routeDay || 1) - 1));
      client.creditStartDate = localDateISO(started);
    }
    if (!Array.isArray(client.visitHistory)) client.visitHistory = [];
    if (!Array.isArray(client.paidPeriodIndexes)) client.paidPeriodIndexes = [];
    if (typeof client.paymentWarning !== 'boolean') client.paymentWarning = false;
    if (!Number.isFinite(Number(client.schedulePaidBaseline))) client.schedulePaidBaseline = Number(client.paid || 0);
  });
}

/**
 * Días que lleva la cartulina: hoy − fecha de inicio (como el sistema anterior, que lo
 * calculaba al abrirla). Va subiendo solo cada día y se detiene el día en que la cartulina
 * quedó pagada (settledAt o, si no está, el último abono).
 */
function creditDay(client, today = localDateISO()) {
  if (!client?.creditStartDate) return Math.max(0, Number(client?.routeDay) || 0);
  let end = today;
  if (Number(client.balance) <= 0) {
    const lastPayment = (client.payments || []).map(payment => String(payment.date || '')).sort().at(-1);
    const settled = client.settledAt || lastPayment;
    if (settled && settled < end) end = settled;
  }
  return Math.max(0, dayDifference(client.creditStartDate, end));
}

/** Fecha de inicio para que la cartulina lleve `day` días hoy (al corregirlo a mano). */
function startDateForCreditDay(day, today = localDateISO()) {
  const start = localDate(today);
  start.setDate(start.getDate() - Math.max(0, Math.round(Number(day) || 0)));
  return localDateISO(start);
}

function paymentCycleIndex(client, dateValue = localDateISO()) {
  let cycle = 0;
  while (cycle < 10000 && dateValue > paymentDueDate(client, cycle)) cycle += 1;
  return cycle;
}

function paymentDueDate(client, cycleIndex) {
  const start = localDate(client.creditStartDate || localDateISO());
  if (client.frequency !== 'monthly') {
    start.setDate(start.getDate() + (cycleIndex + 1) * (paymentFrequencyDays[client.frequency] || 7));
    return localDateISO(start);
  }
  const originalDay = start.getDate();
  const monthStart = new Date(start.getFullYear(), start.getMonth() + cycleIndex + 1, 1);
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  monthStart.setDate(Math.min(originalDay, lastDay));
  return localDateISO(monthStart);
}

function paymentAmountForCycle(client, cycleIndex) {
  return (client.payments || []).reduce((total, payment) => {
    const index = Number.isInteger(payment.cycleIndex) ? payment.cycleIndex : paymentCycleIndex(client, payment.date);
    return index === cycleIndex ? total + Number(payment.amount || 0) : total;
  }, 0);
}

function currentCyclePaymentAmount(client) {
  return paymentAmountForCycle(client, paymentCycleIndex(client));
}

/**
 * Clasifica el comportamiento de pago de un crédito.
 * tier: 'good' (al día) · 'regular' (historial irregular o atraso < medio período ×2)
 *       · 'bad' (atraso de al menos un período completo). Lo usan la biblioteca y el mapa.
 */
/**
 * Foto del calendario de pagos: cuántas cuotas ya vencieron, cuántas están pagadas y
 * cuántos períodos van atrasados (según la frecuencia: diaria, semanal, quincenal o mensual).
 */
function scheduleSnapshot(client, today = localDateISO()) {
  const installments = Number(client.installments || 0) || Infinity;
  let dueCount = 0;        // cuotas con fecha <= hoy (incluye la que vence hoy)
  let overdueDueCount = 0; // cuotas con fecha < hoy (ya vencidas)
  while (dueCount < 10000 && dueCount < installments && paymentDueDate(client, dueCount) <= today) {
    if (paymentDueDate(client, dueCount) < today) overdueDueCount += 1;
    dueCount += 1;
  }
  const cycleSums = new Map();
  (client.payments || []).forEach(payment => {
    const cycle = Number.isInteger(payment.cycleIndex) ? payment.cycleIndex : paymentCycleIndex(client, payment.date);
    cycleSums.set(cycle, (cycleSums.get(cycle) || 0) + Number(payment.amount || 0));
  });
  const completedCycles = new Set([...cycleSums].filter(([, amount]) => amount >= Number(client.installment || 0)).map(([cycle]) => cycle));
  let sequentialPaidCycles = 0;
  while (completedCycles.has(sequentialPaidCycles)) sequentialPaidCycles += 1;
  const paidCount = Math.min(Number(client.installments || 0), Math.max(Number(client.schedulePaidBaseline || 0), sequentialPaidCycles));
  const settled = Number(client.balance) <= 0;
  const missingCount = settled ? 0 : Math.max(0, dueCount - paidCount);
  const overduePeriods = settled ? 0 : Math.max(0, overdueDueCount - paidCount);
  const firstMissingCycle = Math.min(Math.max(0, paidCount), Math.max(0, dueCount - 1));
  const overdueDays = missingCount > 0 ? Math.max(0, dayDifference(paymentDueDate(client, firstMissingCycle), today)) : 0;
  const latePaidCycles = [...cycleSums.entries()].filter(([cycle, amount]) => {
    if (amount < Number(client.installment || 0)) return false;
    const deadline = paymentDueDate(client, cycle);
    const dates = (client.payments || []).filter(payment => (Number.isInteger(payment.cycleIndex) ? payment.cycleIndex : paymentCycleIndex(client, payment.date)) === cycle).map(payment => payment.date).sort();
    const lastPaymentDate = dates[dates.length - 1];
    return lastPaymentDate && lastPaymentDate > deadline;
  }).length;
  const missedVisits = (client.visitHistory || []).filter(item => item.outcome === 'no-payment').length;
  return { settled, missingCount, overduePeriods, overdueDays, latePaidCycles, missedVisits, dueToday: missingCount > overduePeriods };
}

/**
 * Estado ACTUAL de pagos (lo que se ve desde afuera: listas, Inicio y mapa).
 * Cuenta los pagos atrasados por período según la frecuencia de la cartulina:
 * una semana sin pagar en una semanal = «Pagos atrasados 1»; dos meses en una mensual = 2.
 * tier: good (al día) · regular (1 pago atrasado) · bad (2 o más).
 */
function paymentBehavior(client) {
  const snap = scheduleSnapshot(client);
  const explicitlyMissed = snap.missedVisits > 0;
  const latePaid = snap.latePaidCycles > 0;
  const base = { overdueDays: snap.overdueDays, missingCount: snap.missingCount, overduePeriods: snap.overduePeriods, latePaid, explicitlyMissed,
    warning: Boolean(client.paymentWarning || snap.overduePeriods > 0 || latePaid || explicitlyMissed) };
  if (snap.settled) return { ...base, tier: 'good', color: '#00C853', label: 'Cartulina pagada' };
  if (snap.overduePeriods >= 2) return { ...base, tier: 'bad', color: '#E53935', label: `Pagos atrasados ${snap.overduePeriods}` };
  if (snap.overduePeriods === 1) return { ...base, tier: 'regular', color: '#FF9800', label: 'Pagos atrasados 1' };
  if (snap.dueToday) return { ...base, tier: 'good', color: '#00C853', label: 'Cuota vence hoy' };
  return { ...base, tier: 'good', color: '#00C853', label: 'Pagos al día' };
}

const HISTORY_RANK = { good: 0, irregular: 1, bad: 2 };

/**
 * Desde este día rige la calificación por puntos. Lo que pasó antes queda calificado como
 * estaba (con las reglas anteriores, congeladas al día previo).
 */
const RATING_SYSTEM_START = '2026-10-26';
const RATING_LEGACY_UNTIL = '2026-10-25';
const ratingSystemActive = (today = localDateISO()) => today >= RATING_SYSTEM_START;

/** Puntos que resta cada cosa. Con 3 puntos baja a irregular y con 8 a malo. */
const RATING_POINTS = { shortDelay: 1, longDelay: 2, noPayment: 3, legacyIncident: 3 };
const SHORT_DELAY_DAYS = 3;
const levelFromPoints = points => (points >= 8 ? 'bad' : points >= 3 ? 'irregular' : 'good');

/** Reglas anteriores (incidentes): cuotas pagadas tarde, visitas sin pago y períodos atrasados. */
function legacyHistory(snap, client, overduePeriods = snap.overduePeriods) {
  const incidents = snap.latePaidCycles + snap.missedVisits + overduePeriods;
  const level = overduePeriods >= 2 || incidents >= 3 ? 'bad' : incidents >= 1 || client.paymentWarning ? 'irregular' : 'good';
  return { level, incidents };
}

/** La cartulina tal como estaba al cerrar el último día con las reglas anteriores. */
function legacyView(client) {
  return {
    ...client,
    payments: (client.payments || []).filter(payment => String(payment.date) <= RATING_LEGACY_UNTIL),
    visitHistory: (client.visitHistory || []).filter(visit => String(visit.date) <= RATING_LEGACY_UNTIL),
  };
}

/**
 * Puntos por demora de las cuotas que vencen desde RATING_SYSTEM_START:
 *  - Pagó el día de la cuota (o antes): 0.
 *  - Pagó unos días tarde, antes de la cuota siguiente: 1 punto (hasta 3 días) o 2 (más días).
 *    Mientras no paga, se ve como pago atrasado y ya cuenta esa demora.
 *  - Llegó la cuota siguiente sin pagar la anterior: no pago, 3 puntos. Si después la paga
 *    (por ejemplo dos en uno) se le quita el no pago, pero quedan los 2 puntos de demora.
 * Una cuota se da por pagada cuando lo abonado desde el inicio del crédito alcanza esa cuota.
 * Las cuotas de antes del cambio que ya estaban pagadas el último día de las reglas anteriores
 * quedan con esas reglas; las que seguían sin pagar (`oldOpen`) se miden con estas, y `oldUnpaid`
 * cuenta las que todavía no se pagan.
 */
function delayPoints(client, today = localDateISO()) {
  const installment = Number(client.installment) || 0;
  if (!installment) return { points: 0, delays: 0, noPayments: 0, oldUnpaid: 0, oldOpen: 0 };
  const installments = Number(client.installments || 0) || Infinity;
  const baselineAmount = Number(client.schedulePaidBaseline || 0) * installment;
  const payments = (client.payments || [])
    .filter(payment => !payment.beforeRestructure && payment.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  /** Fecha en que lo abonado llegó a `amount` (null si todavía no llega). */
  const coveredOn = amount => {
    if (baselineAmount >= amount) return '';
    let total = 0;
    for (const payment of payments) {
      total += Number(payment.amount) || 0;
      if (Math.max(total, baselineAmount) >= amount) return payment.date;
    }
    return null;
  };
  const result = { points: 0, delays: 0, noPayments: 0, oldUnpaid: 0, oldOpen: 0 };
  for (let cycle = 0; cycle < installments && cycle < 10000; cycle += 1) {
    const due = paymentDueDate(client, cycle);
    if (due >= today) break; // la cuota de hoy todavía se puede pagar hoy
    const covered = coveredOn((cycle + 1) * installment);
    if (due < RATING_SYSTEM_START) {
      if (covered !== null && covered <= RATING_LEGACY_UNTIL) continue;
      result.oldOpen += 1;
      if (covered === null) result.oldUnpaid += 1;
    }
    if (covered !== null && covered <= due) continue;
    const next = paymentDueDate(client, cycle + 1);
    if (covered === null && today >= next) { result.points += RATING_POINTS.noPayment; result.noPayments += 1; continue; }
    const late = dayDifference(due, covered || today);
    result.points += late <= SHORT_DELAY_DAYS ? RATING_POINTS.shortDelay : RATING_POINTS.longDelay;
    result.delays += 1;
  }
  return result;
}

/**
 * HISTORIAL de la cartulina (la «cicatriz» que se ve al entrar a la ficha).
 *  - Hasta RATING_LEGACY_UNTIL: incidentes (1 → irregular, 3 o 2 períodos atrasados → malo).
 *  - Desde RATING_SYSTEM_START: puntos por demora (ver delayPoints). Cada incidente anterior
 *    vale 3 puntos, así nadie mejora ni empeora por el cambio de reglas.
 * Nunca queda mejor que el peor nivel guardado antes del cambio (client.worstHistory).
 */
function paymentHistory(client) {
  const today = localDateISO();
  let level;
  let incidents;
  let points = 0;
  if (!ratingSystemActive(today)) {
    ({ level, incidents } = legacyHistory(scheduleSnapshot(client, today), client));
  } else {
    const recent = delayPoints(client, today);
    let legacy = { level: client.paymentWarning ? 'irregular' : 'good', incidents: 0 };
    let legacyPoints = 0;
    if (String(client.creditStartDate || '') <= RATING_LEGACY_UNTIL) {
      const snap = scheduleSnapshot(legacyView(client), RATING_LEGACY_UNTIL);
      // El nivel de antes se conserva mientras sigan sin pagar las cuotas atrasadas de entonces.
      // Cada una que paga después del cambio le quita un período atrasado de entonces.
      legacy = legacyHistory(snap, client, Math.max(0, snap.overduePeriods - (recent.oldOpen - recent.oldUnpaid)));
      // Esas cuotas atrasadas ya las mide delayPoints: aquí solo valen los incidentes cerrados.
      legacyPoints = (snap.latePaidCycles + snap.missedVisits) * RATING_POINTS.legacyIncident;
    }
    points = legacyPoints + recent.points;
    incidents = legacy.incidents + recent.delays + recent.noPayments;
    const byPoints = levelFromPoints(points);
    level = HISTORY_RANK[legacy.level] > HISTORY_RANK[byPoints] ? legacy.level : byPoints;
  }
  // La cicatriz nunca mejora: se conserva el peor nivel alcanzado.
  if (HISTORY_RANK[client.worstHistory] > HISTORY_RANK[level]) level = client.worstHistory;
  const meta = {
    good: { color: '#00C853', label: 'Historial bueno', detail: 'Ha pagado siempre dentro de la frecuencia acordada.' },
    irregular: { color: '#F9A825', label: 'Historial irregular', detail: 'Tuvo atrasos o pagos tardíos en esta cartulina.' },
    bad: { color: '#E53935', label: 'Historial malo', detail: 'Acumuló varios atrasos en esta cartulina.' },
  }[level];
  return { level, incidents, points, ...meta };
}

/**
 * Guarda el peor nivel de historial alcanzado (la cicatriz persiste). Con las reglas por
 * puntos ya no se guarda: los puntos de demora son la cicatriz y el no pago se quita al pagar.
 */
function rememberWorstHistory(client) {
  const { level } = paymentHistory(client);
  if (ratingSystemActive()) return level;
  if (HISTORY_RANK[level] > (HISTORY_RANK[client.worstHistory] ?? -1)) client.worstHistory = level;
  if (level !== 'good') client.paymentWarning = true;
  return level;
}

// ── js/domain/person-cards.js
/**
 * domain/person-cards · Varias cartulinas a nombre de una misma persona.
 *
 * Cada cartulina sigue siendo un registro independiente en `clients` (su propio saldo,
 * cuota, calendario y abonos). Lo que las agrupa es la cédula de la persona. Así el
 * cobrador ve y cobra cada cartulina por separado, y la ficha permite saltar entre ellas.
 */

/** Máximo de cartulinas ACTIVAS (con saldo) que puede tener una misma persona. */
const MAX_ACTIVE_CARDS_PER_PERSON = 4;

function personKey(idNumber) {
  const raw = String(idNumber ?? '').trim();
  return raw.replace(/\D/g, '') || raw.toLocaleLowerCase('es');
}

/** Todas las cartulinas de la persona (activas, canceladas y renovadas), de la más antigua a la más reciente. */
function personCardIds(clients, idNumber) {
  const key = personKey(idNumber);
  if (!key) return [];
  return Object.keys(clients)
    .filter(id => clients[id] && personKey(clients[id].id) === key)
    .sort((a, b) => String(clients[a].creditStartDate || '').localeCompare(String(clients[b].creditStartDate || '')) || a.localeCompare(b));
}

/**
 * Veces que se le ha prestado a la persona: cada cartulina a su nombre (activas, canceladas
 * o renovadas) más cada retanqueo. Devuelve { total, cards, retanqueos }.
 */
function loanCount(clients, idNumber) {
  const ids = personCardIds(clients, idNumber);
  const retanqueos = ids.reduce((sum, id) => sum + (clients[id].restructures || []).filter(entry => entry.type === 'retanqueo').length, 0);
  return { total: ids.length + retanqueos, cards: ids.length, retanqueos };
}

/** Texto del contador: «3 préstamos» o «3 préstamos (1 retanqueo)». */
function loanCountLabel(count) {
  const base = `${count.total} préstamo${count.total === 1 ? '' : 's'}`;
  return count.retanqueos ? `${base} (${count.retanqueos} retanqueo${count.retanqueos === 1 ? '' : 's'})` : base;
}

function isActiveCard(client) {
  return Number(client?.balance) > 0;
}

function activeCardIds(clients, idNumber) {
  return personCardIds(clients, idNumber).filter(id => isActiveCard(clients[id]));
}

/** Número de la cartulina dentro de la persona (1, 2, 3…), o 0 si no la encuentra. */
function cardNumber(clients, clientId) {
  return personCardIds(clients, clients[clientId]?.id).indexOf(clientId) + 1;
}

/**
 * Nombre de la cartulina para mostrar junto al cliente. Se numeran solo las ACTIVAS (las
 * canceladas no ocupan número): «Cartulina 2». Vacío si la persona tiene una sola activa;
 * «Cartulina cancelada» si esta ya no tiene saldo y la persona tiene otras.
 */
function cardLabel(clients, clientId) {
  const client = clients[clientId];
  if (!client) return '';
  const active = activeCardIds(clients, client.id);
  if (!isActiveCard(client)) return personCardIds(clients, client.id).length > 1 ? 'Cartulina cancelada' : '';
  return active.length > 1 ? `Cartulina ${active.indexOf(clientId) + 1}` : '';
}

/** ¿Se puede abrir otra cartulina simultánea para esta persona? */
function canAddCard(clients, idNumber) {
  return activeCardIds(clients, idNumber).length < MAX_ACTIVE_CARDS_PER_PERSON;
}

// ── js/domain/restructure.js
/**
 * domain/restructure · Cambios a una cartulina con saldo, hechos por el admin.
 *
 * - Financiar: se le suman intereses por pasarse de los días acordados y se le da un plazo nuevo.
 * - Retanqueo: se le presta más antes de terminar de pagar; al monto extra se le suman intereses
 *   (20 % general) y se cobran seguros (10 % general), salvo que el admin ponga otro valor.
 *
 * En los dos casos el saldo nuevo arranca un calendario nuevo desde hoy (cuotas y plazo nuevos)
 * y el total del crédito sube en lo agregado, así «abonado + saldo = total» sigue cuadrando.
 * Los abonos anteriores siguen en el historial, pero ya no cuentan para las cuotas nuevas.
 */





const RETANQUEO_INTEREST_PERCENT = 20;
const FINANCE_INTEREST_PERCENT = 20;
/** Seguros generales sobre el monto extra de un retanqueo (los mismos 10 % de un préstamo). */
const GENERAL_RETANQUEO = { insurancePercent: GENERAL_INSURANCE_PERCENT };

/** Valor de un porcentaje o, si se escribió, el monto exacto. */
function percentOrAmount(base, percent, exactAmount) {
  const exact = Number(exactAmount);
  if (String(exactAmount ?? '').trim() !== '' && Number.isFinite(exact) && exact >= 0) return Math.round(exact);
  return Math.round((Number(base) || 0) * (Number(percent) || 0) / 100);
}

/**
 * Inicio del calendario nuevo. Las semanales siguen pagando el mismo día de la semana
 * (y conservan su color): arrancan el último día con ese día de la semana hasta hoy.
 */
function restartDate(client, today) {
  const [year, month, day] = String(client.creditStartDate || '').split('-').map(Number);
  if ((client.frequency || 'weekly') !== 'weekly' || !year) return today;
  const [ty, tm, td] = today.split('-').map(Number);
  const start = new Date(ty, tm - 1, td);
  start.setDate(start.getDate() - ((start.getDay() - new Date(year, month - 1, day).getDay() + 7) % 7));
  return localDateISO(start);
}

/** Calendario nuevo desde hoy para el saldo actual. */
function restartSchedule(client, totalDays, today) {
  const days = Math.max(1, Math.round(Number(totalDays) || Number(client.totalDays) || 30));
  const frequencyDays = paymentFrequencyDays[client.frequency] || 7;
  const startDate = restartDate(client, today);
  const installments = Math.max(1, Math.ceil(days / frequencyDays));
  // Los abonos anteriores quedan fuera de las cuotas nuevas (ciclo −1).
  (client.payments || []).forEach(payment => { payment.cycleIndex = -1; payment.beforeRestructure = true; });
  Object.assign(client, {
    creditStartDate: startDate, totalDays: days, term: `${days} días`, routeDay: 1,
    installments, installment: Math.ceil(Number(client.balance) / installments),
    paid: 0, paidPeriodIndexes: [], schedulePaidBaseline: 0, late: false, status: 'Al día', settledAt: null,
  });
}

/** Financiar: suma `interest` al saldo y da un plazo nuevo de `totalDays` días desde hoy. */
function financeCard(client, { interest, totalDays, by = 'Administrador', today = localDateISO() }) {
  const amount = Math.max(0, Math.round(Number(interest) || 0));
  const before = { balance: Number(client.balance), total: Number(client.total), totalDays: client.totalDays, creditStartDate: client.creditStartDate };
  client.balance = Number(client.balance) + amount;
  client.total = Number(client.total) + amount;
  client.interestHistory ||= [];
  if (amount) client.interestHistory.unshift({ date: today, amount, type: 'financiacion' });
  restartSchedule(client, totalDays, today);
  client.restructures ||= [];
  client.restructures.unshift({ type: 'financiacion', date: today, at: new Date().toISOString(), by, interest: amount, before });
  return { interest: amount, balance: client.balance };
}

/**
 * Retanqueo: presta `extra` más a la cartulina. El saldo sube en extra + intereses; los seguros
 * se cobran en efectivo hoy (entran a la base del día, como al entregar un préstamo).
 * Devuelve lo que hay que registrar en la liquidación del cobro.
 */
function retanqueoCard(client, { extra, interest, insurance, insuranceReason = '', totalDays, by = 'Administrador', today = localDateISO(), now = Date.now() }) {
  const amount = Math.max(0, Math.round(Number(extra) || 0));
  const interestAmount = Math.max(0, Math.round(Number(interest) || 0));
  const insuranceAmount = Math.max(0, Math.round(Number(insurance) || 0));
  const before = { balance: Number(client.balance), total: Number(client.total), principal: Number(client.principal), totalDays: client.totalDays, creditStartDate: client.creditStartDate };
  client.principal = Number(client.principal || 0) + amount;
  client.balance = Number(client.balance) + amount + interestAmount;
  client.total = Number(client.total) + amount + interestAmount;
  client.breakdown = `${formatMoney(client.principal)} / ${formatMoney(client.total - client.principal)}`;
  if (insuranceAmount) {
    client.extraInsurance ||= [];
    client.extraInsurance.push({ date: today, ts: now, amount: insuranceAmount, reason: insuranceReason ? `Retanqueo · ${insuranceReason}` : 'Retanqueo' });
  }
  restartSchedule(client, totalDays, today);
  client.restructures ||= [];
  client.restructures.unshift({ type: 'retanqueo', date: today, at: new Date(now).toISOString(), by, extra: amount, interest: interestAmount, insurance: insuranceAmount, before });
  return { extra: amount, interest: interestAmount, insurance: insuranceAmount, balance: client.balance };
}

/**
 * Liquidación del cobro al hacer un retanqueo: el extra sale hoy como préstamo y los seguros
 * entran a la base del día (como al entregar un préstamo nuevo).
 */
function recordRetanqueoInRoute(route, client, clientId, { extra, interest, insurance }) {
  if (!route) return;
  route.loans = Number(route.loans || 0) + extra;
  route.base = Number(route.base || 0) + insurance;
  route.monthlyInsurance = (Number(route.monthlyInsurance) || 0) + insurance;
  route.loansNew ||= [];
  route.loansEntered ||= [];
  route.loansNew.unshift({ name: `${client.name} (retanqueo)`, clientId, amount: extra });
  route.loansEntered.unshift({ name: `${client.name} (retanqueo)`, clientId, amount: extra + interest });
}

/** Solicitud pendiente de financiar o retanquear esta cartulina (o undefined). */
function pendingRestructure(requests, clientId) {
  return requests.find(request => request.status === 'pending' && request.clientId === clientId && (request.type === 'finance' || request.type === 'retanqueo'));
}

// ── js/features/admin/access-hours.js
/**
 * features/admin/access-hours · Tarjeta «Horario de acceso de trabajadores»
 * (Gestión de Personal). Guarda la regla en security.workerAccess.
 */





const ah = selector => document.querySelector(selector);

function setBodyEnabled(enabled) {
  ah('#access-schedule-body').classList.toggle('is-disabled', !enabled);
  ah('#access-schedule-body').querySelectorAll('input').forEach(input => { input.disabled = !enabled; });
}

function readForm() {
  return {
    enabled: ah('#access-enabled').checked,
    days: [...document.querySelectorAll('input[name="accessDay"]:checked')].map(input => Number(input.value)),
    start: ah('#access-start').value,
    end: ah('#access-end').value,
  };
}

function renderSummary(schedule, saved = true) {
  ah('#access-schedule-summary').textContent = describeSchedule(schedule);
  const status = ah('#access-status');
  if (!saved) { status.textContent = 'Cambios sin guardar'; status.dataset.tone = 'pending'; return; }
  if (!schedule.enabled) { status.textContent = ''; status.dataset.tone = ''; return; }
  const open = isWithinSchedule(schedule);
  status.textContent = open ? '● Ahora mismo los trabajadores pueden ingresar' : '● Ahora mismo el ingreso está cerrado';
  status.dataset.tone = open ? 'open' : 'closed';
}

function renderAccessSchedule() {
  const schedule = security.workerAccess;
  ah('#access-enabled').checked = Boolean(schedule.enabled);
  document.querySelectorAll('input[name="accessDay"]').forEach(input => { input.checked = (schedule.days || []).includes(Number(input.value)); });
  ah('#access-start').value = schedule.start || '06:00';
  ah('#access-end').value = schedule.end || '20:00';
  setBodyEnabled(schedule.enabled);
  renderSummary(schedule);
}

function __mount_accessHoursModule() {
  const form = ah('#access-schedule-form');
  form.addEventListener('input', () => {
    setBodyEnabled(ah('#access-enabled').checked);
    renderSummary(readForm(), false);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (state.userRole !== 'admin') return;
    const next = readForm();
    if (next.enabled) {
      if (!next.days.length) { ah('#access-status').textContent = 'Elige al menos un día.'; ah('#access-status').dataset.tone = 'closed'; return; }
      if (!next.start || !next.end || next.start === next.end) { ah('#access-status').textContent = 'La hora de inicio y la de fin deben ser distintas.'; ah('#access-status').dataset.tone = 'closed'; return; }
    }
    Object.assign(security.workerAccess, next);
    persistBusinessData();
    renderAccessSchedule();
    showToast(next.enabled ? `Horario de acceso guardado: ${describeSchedule(next)}.` : 'Restricción de horario desactivada.');
  });
  renderAccessSchedule();
}

// ── js/features/admin/account-settings.js
/**
 * features/admin/account-settings · Configuración del administrador: tema claro/oscuro,
 * cambio de contraseña y clave de recuperación. También atiende «¿Olvidaste tu
 * contraseña?» en la pantalla de ingreso.
 *
 * Con servidor (Supabase) todo pasa por funciones de supabase/cuenta.sql: la contraseña
 * y la clave se comparan cifradas en la base de datos y nunca viajan de vuelta.
 * Sin servidor (modo local) se guardan cifradas en `security.admin` de este navegador.
 */









const MIN_PASSWORD = 8;

/** Normaliza la clave: solo letras/números en mayúscula (acepta guiones, espacios o minúsculas). */
function cleanRecoveryKey(value) {
  return String(value || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
}

function prettyKey(raw) {
  return raw.match(/.{1,6}/g).join('-');
}

function randomRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function rpc(name, params) {
  const db = await backend();
  const { data, error } = await db.rpc(name, params);
  if (error) throw new Error(backendErrorMessage(error));
  return data;
}

/** Contraseña local vigente del admin (la cambiada en Configuración o la inicial). */
function localAdminPasswordHash() {
  return security.admin.passwordHash || adminPasswordHash;
}

function validateNewPassword(values) {
  if (String(values.newPassword || '').length < MIN_PASSWORD) return `La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (values.newPassword !== values.confirmPassword) return 'La confirmación no coincide con la nueva contraseña.';
  return '';
}

// ── Pantalla de Configuración ──

async function renderAccountSettings() {
  const light = document.documentElement.dataset.theme === 'light';
  const toggle = document.querySelector('#admin-theme-toggle');
  if (toggle) toggle.checked = light;
  const description = document.querySelector('#admin-theme-description');
  if (description) description.textContent = light ? 'Apariencia clara' : 'Apariencia oscura';
  const idle = document.querySelector('#admin-idle-hours');
  if (idle && document.activeElement !== idle) idle.value = String(Number(security.session?.idleHours) || 12);
  const status = document.querySelector('#admin-recovery-status');
  const button = document.querySelector('#admin-recovery-key');
  if (!status || !button) return;
  let createdAt = null;
  try {
    createdAt = backendEnabled() ? await rpc('my_recovery_key_date', {}) : security.admin.recoveryKeyCreatedAt || null;
  } catch { /* sin conexión: se muestra el texto general */ }
  if (createdAt) {
    const date = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(createdAt));
    status.textContent = `Clave activa, creada el ${date}. Si la pierdes, genera una nueva: la anterior deja de servir.`;
    button.textContent = 'Generar otra';
  } else {
    status.textContent = 'Aún no tienes una. Sirve para entrar si olvidas la contraseña o pierdes el celular del autenticador.';
    button.textContent = 'Generar';
  }
}

function openChangePassword() {
  openCustomModal({
    title: 'Cambiar contraseña',
    description: 'Escribe tu contraseña actual y la nueva (mínimo 8 caracteres).',
    submitLabel: 'Cambiar contraseña',
    fields: [
      { name: 'currentPassword', label: 'Contraseña actual', type: 'password', required: true },
      { name: 'newPassword', label: 'Nueva contraseña', type: 'password', minLength: MIN_PASSWORD, required: true },
      { name: 'confirmPassword', label: 'Repite la nueva contraseña', type: 'password', minLength: MIN_PASSWORD, required: true },
    ],
    onSubmit: async values => {
      const problem = validateNewPassword(values);
      if (problem) { customModalError.textContent = problem; return false; }
      try {
        if (backendEnabled()) {
          await rpc('change_my_password', { current_password: values.currentPassword, new_password: values.newPassword });
        } else {
          if (await hashCredential(values.currentPassword) !== localAdminPasswordHash()) throw new Error('La contraseña actual no es correcta.');
          security.admin.passwordHash = await hashCredential(values.newPassword);
          persistBusinessData();
        }
      } catch (error) { customModalError.textContent = error.message; return false; }
      showToast('Contraseña cambiada. Úsala desde tu próximo ingreso.');
    },
  });
}

function showRecoveryKey(key) {
  openCustomModal({
    title: 'Tu clave de recuperación',
    description: 'Guárdala fuera del celular (anotada en papel o en un lugar seguro). Solo se muestra esta vez. Con ella y tu usuario puedes poner una contraseña nueva desde «¿Olvidaste tu contraseña?»; al usarla se quita el autenticador y lo vuelves a registrar.',
    submitLabel: 'Ya la guardé',
    cancelLabel: 'Copiar',
    fields: [{ name: 'recoveryKey', label: 'Clave de recuperación', value: key }],
    onCancel: () => {
      navigator.clipboard?.writeText(key).then(() => showToast('Clave copiada.'), () => showToast('Selecciónala y cópiala manualmente.'));
      return false;
    },
    onSubmit: () => { renderAccountSettings(); },
  });
}

function openRecoveryKey() {
  openCustomModal({
    title: 'Generar clave de recuperación',
    description: 'Confirma tu contraseña actual. Si ya tenías una clave, la anterior deja de funcionar.',
    submitLabel: 'Generar clave',
    fields: [{ name: 'currentPassword', label: 'Contraseña actual', type: 'password', required: true }],
    onSubmit: async values => {
      let key;
      try {
        if (backendEnabled()) {
          key = await rpc('create_my_recovery_key', { current_password: values.currentPassword });
        } else {
          if (await hashCredential(values.currentPassword) !== localAdminPasswordHash()) throw new Error('La contraseña actual no es correcta.');
          const raw = randomRecoveryKey();
          security.admin.recoveryKeyHash = await hashCredential(raw);
          security.admin.recoveryKeyCreatedAt = new Date().toISOString();
          persistBusinessData();
          key = prettyKey(raw);
        }
      } catch (error) { customModalError.textContent = error.message; return false; }
      window.setTimeout(() => showRecoveryKey(key), 30);
    },
  });
}

// ── «¿Olvidaste tu contraseña?» (pantalla de ingreso) ──

function openForgotPassword() {
  openCustomModal({
    title: 'Recuperar acceso',
    description: 'Usa la clave de recuperación que generaste en Configuración. Si eres trabajador, pide al administrador una contraseña nueva (Gestión de Personal → Credenciales).',
    submitLabel: 'Cambiar contraseña',
    fields: [
      { name: 'username', label: 'Usuario', value: document.querySelector('#login-user')?.value || '', required: true },
      { name: 'recoveryKey', label: 'Clave de recuperación', placeholder: 'XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX', required: true },
      { name: 'newPassword', label: 'Nueva contraseña', type: 'password', minLength: MIN_PASSWORD, required: true },
      { name: 'confirmPassword', label: 'Repite la nueva contraseña', type: 'password', minLength: MIN_PASSWORD, required: true },
    ],
    onSubmit: async values => {
      const problem = validateNewPassword(values);
      if (problem) { customModalError.textContent = problem; return false; }
      const key = cleanRecoveryKey(values.recoveryKey);
      try {
        if (backendEnabled()) {
          await rpc('recover_password', { login_email: usernameToEmail(values.username), recovery_key: key, new_password: values.newPassword });
        } else {
          const isAdmin = String(values.username).trim().toLocaleLowerCase('es') === 'admin';
          if (!isAdmin || !security.admin.recoveryKeyHash || await hashCredential(key) !== security.admin.recoveryKeyHash) throw new Error('Usuario o clave de recuperación incorrectos.');
          security.admin.passwordHash = await hashCredential(values.newPassword);
          security.admin.totpSecret = null;
          security.admin.recoveryHashes = [];
          security.admin.enrolledAt = null;
          security.admin.recoveryKeyHash = null;
          security.admin.recoveryKeyCreatedAt = null;
          persistBusinessData();
        }
      } catch (error) {
        customModalError.textContent = /incorrect/i.test(error.message) ? 'Usuario o clave de recuperación incorrectos.' : error.message;
        return false;
      }
      const passwordInput = document.querySelector('#login-password');
      if (passwordInput) passwordInput.value = '';
      const userInput = document.querySelector('#login-user');
      if (userInput) userInput.value = values.username.trim();
      showToast('Listo: entra con tu nueva contraseña y vuelve a registrar el autenticador. Genera una clave de recuperación nueva en Configuración.');
    },
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_accountSettingsModule() {
  document.querySelector('#admin-theme-toggle')?.addEventListener('change', event => {
    applyTheme(event.target.checked ? 'light' : 'dark');
    renderAccountSettings();
  });
  document.querySelector('#admin-change-password')?.addEventListener('click', openChangePassword);
  // Horas sin usar la app antes de cerrar la sesión: se guarda en el servidor para todos.
  document.querySelector('#admin-idle-hours')?.addEventListener('change', event => {
    const hours = Number(event.target.value);
    if (!Number.isFinite(hours) || hours <= 0) return;
    security.session.idleHours = hours;
    try { localStorage.setItem('edgecredit-session-settings', JSON.stringify(security.session)); } catch { /* opcional */ }
    persistBusinessData();
    showToast(`Las sesiones se cerrarán tras ${hours} hora${hours === 1 ? '' : 's'} sin usar la app.`);
  });
  document.querySelector('#admin-recovery-key')?.addEventListener('click', openRecoveryKey);
  document.querySelector('#login-forgot')?.addEventListener('click', openForgotPassword);
}

// ── js/features/admin/admin-shell.js
/**
 * features/admin/admin-shell · Panel de administración: selector de ruta, secciones
 * y modo "directorio de ruta".
 */















/** «Hoy · 5 de octubre»: la fecha de la liquidación sale del reloj, no del marcado. */
function renderRouteDate() {
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
function syncRouteSelect() {
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
function updateRouteAvailability() {
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
function defaultAdminPanel() {
  return Object.keys(routeSettlements).length ? 'settlement' : 'personnel';
}

function renderAdminRoute(routeId) {
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
  renderDayPayments(routeId);
  renderBaseBreakdown(routeId);
  renderSettlementOtherNote(routeId);
  renderMondayBase(routeId);
  renderRouteEvidence(routeId);
  renderRouteReports(route);
  recalculateSettlement();
}

function enterAdminDirectory() {
  adminView.hidden = true;
  workerView.hidden = false;
  document.body.classList.add('admin-client-mode');
  state.userRole = 'admin';
  document.querySelector('#add-client').hidden = true;
  document.querySelector('#admin-add-client').hidden = false;
  document.querySelector('#nav-daily-route').hidden = true;
  document.querySelector('#nav-map').hidden = true;
  gpsIndicator.hidden = true;
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

function showAdminPanel(panelName) {
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

/** Menú lateral del celular: se abre con ☰ y se cierra al elegir una sección, con × o tocando fuera. */
function setAdminMenuOpen(open) {
  document.body.classList.toggle('admin-menu-open', open);
  document.querySelector('#admin-menu-backdrop').hidden = !open;
  document.querySelector('#admin-menu-toggle').setAttribute('aria-expanded', String(open));
  if (open) document.querySelector('#admin-menu-close').focus();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_adminShellModule() {
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
  const closeMenu = () => setAdminMenuOpen(false);
  document.querySelector('#admin-menu-toggle').addEventListener('click', () => setAdminMenuOpen(true));
  document.querySelector('#admin-menu-close').addEventListener('click', closeMenu);
  document.querySelector('#admin-menu-backdrop').addEventListener('click', closeMenu);
  document.querySelectorAll('#admin-global-directory, [data-admin-section]').forEach(button => button.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('admin-menu-open')) closeMenu(); });
  window.matchMedia('(min-width:768px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
}

// ── js/features/admin/client-map.js
/**
 * features/admin/client-map · Mapa de clientes del cobro seleccionado.
 * Colorea cada cliente por su comportamiento de pago (mismo criterio que la biblioteca),
 * enfoca el departamento del trabajador asignado y se extiende hasta donde haya clientes.
 * Leaflet se carga bajo demanda la primera vez que se abre la sección.
 */













const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const ESRI_ATTRIBUTION = 'Imágenes &copy; Esri, Maxar, Earthstar Geographics y la comunidad GIS';
const BASEMAP_STORAGE_KEY = 'edgecredit-map-basemap';
// Capas base. "Calles" (por defecto) y "Oscuro" usan CARTO con la key de core/map-config.js;
// "Satélite" usa Esri y no requiere key.
const cartoLayer = (L, style) => L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png?key=${encodeURIComponent(CARTO_API_KEY)}`, { attribution: CARTO_ATTRIBUTION, subdomains: 'abcd', maxZoom: 20 });
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const BASEMAPS = {
  'Calles': L => CARTO_API_KEY
    ? cartoLayer(L, 'voyager')
    : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: OSM_ATTRIBUTION, maxZoom: 19 }),
  'Satélite': L => L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: ESRI_ATTRIBUTION, maxZoom: 19 }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
  ]),
  ...(CARTO_API_KEY ? { 'Oscuro': L => cartoLayer(L, 'dark_all') } : {}),
};

const TIER_COLORS = { good: '#00C853', regular: '#FF9800', bad: '#E53935' };
const TIER_LABELS = { good: 'Al día', regular: '1 pago atrasado', bad: '2 o más pagos atrasados' };
const SOURCE_LABELS = { alta: 'GPS tomado al crear el cliente', ficha: 'GPS tomado desde la ficha del cliente', abono: 'GPS tomado en un abono', admin: 'Ubicado manualmente por el administrador', trabajador: 'Ubicado manualmente por el trabajador', demo: 'Ubicación de demostración' };

let leafletPromise = null;
let map = null;
let markerLayer = null;
let lastFitKey = '';
let pickClientId = null;
let pickKind = 'main';          // 'main' = domicilio, 'alt' = dirección alternativa
let altLayer = null;            // capa con la dirección alternativa visible (máx. un cliente)
let shownAltClientId = null;    // cliente cuya dirección alternativa se está mostrando
let pendingFit = null;
let focusedClientId = null;     // cliente resaltado en la lista "En el mapa"          // encuadre pendiente hasta que el contenedor tenga tamaño
const markersById = new Map();  // clientId -> marcador, para "ir a" desde la lista
// Recorrido del trabajador del cobro (solo admin): puntos del día elegido y escucha en vivo.
let trackLayer = null;
let trackPoints = [];
let trackKey = '';
let trackWorker = null;
let stopTrackFeed = () => {};
const LIVE_MINUTES = 5;         // última señal más reciente que esto = «en vivo»
const MIN_SPAN = 0.012;         // ~1,3 km: perímetro mínimo alrededor de los clientes
const FOCUS_ZOOM = 17;          // zoom al seleccionar un cliente puntual
const visibleTiers = new Set(['good', 'regular', 'bad']);

const $ = selector => document.querySelector(selector);

/**
 * El mismo mapa sirve al admin (cobro elegido) y al trabajador (solo su propio cobro).
 * Ambos pueden ubicar y reubicar clientes; solo el admin fija la zona del cobro.
 */
const isWorkerMap = () => state.userRole === 'worker';
const mapRouteId = () => (isWorkerMap() ? state.workerRoute : routeSelect.value);

/** Mueve el bloque del mapa al contenedor de la vista activa (panel admin o vista del trabajador). */
function attachMapHost() {
  const layout = document.querySelector('.client-map-layout');
  const host = document.querySelector(isWorkerMap() ? '#worker-map-host' : '#admin-map-host');
  if (layout && host && layout.parentElement !== host) host.append(layout);
  layout?.classList.toggle('is-read-only', isWorkerMap());
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.append(css);
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet no disponible')));
    script.onerror = () => { script.remove(); leafletPromise = null; reject(new Error('Sin conexión al servicio de mapas')); };
    document.head.append(script);
  });
  return leafletPromise;
}

function showMessage(text) {
  const message = $('#client-map-message');
  message.textContent = text;
  message.hidden = !text;
}

function routeEntries(routeId) {
  return Object.entries(clients)
    .filter(([, client]) => client.route === routeId)
    .map(([id, client]) => ({ id, client, risk: paymentBehavior(client) }));
}

function renderSidebar(entries) {
  const counts = { good: 0, regular: 0, bad: 0 };
  entries.forEach(entry => { counts[entry.risk.tier] += 1; });
  Object.entries(counts).forEach(([tier, count]) => { $(`[data-tier-count="${tier}"]`).textContent = String(count); });

  const missing = entries.filter(entry => !hasCoordinates(entry.client.location));
  $('#client-map-missing-count').textContent = String(missing.length);
  const list = $('#client-map-missing');
  list.replaceChildren();
  if (!missing.length) {
    const empty = document.createElement('p');
    empty.className = 'client-map-empty';
    empty.textContent = 'Todos los clientes de este cobro están ubicados.';
    list.append(empty);
    return;
  }
  missing.forEach(({ id, client, risk }) => {
    const row = document.createElement('div');
    row.className = 'client-map-missing-row';
    const dot = document.createElement('i');
    dot.className = 'client-map-dot';
    dot.style.setProperty('--tier-color', TIER_COLORS[risk.tier]);
    dot.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = client.name;
    const address = document.createElement('small');
    address.textContent = client.address || 'Sin dirección';
    copy.append(name, address);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-action map-action-small';
    button.dataset.mapPick = id;
    button.textContent = 'Ubicar';
    if (pickClientId === id) { button.classList.add('is-active'); button.textContent = 'Ubicando…'; button.setAttribute('aria-pressed', 'true'); }
    button.setAttribute('aria-label', `Ubicar a ${client.name} en el mapa`);
    row.append(dot, copy, button);
    list.append(row);
  });
}

function popupContent(id, client, risk) {
  const box = document.createElement('div');
  box.className = 'client-map-popup';
  const name = document.createElement('strong');
  name.textContent = client.name;
  const tier = document.createElement('span');
  tier.className = 'client-map-popup-tier';
  tier.style.setProperty('--tier-color', TIER_COLORS[risk.tier]);
  tier.textContent = risk.label;
  const facts = document.createElement('dl');
  [['Cédula', client.id], ['Saldo', formatMoney(client.balance)], ['Cuota', formatMoney(client.installment)], ['Dirección', client.address || '—'], ...(client.altAddress ? [['Dir. alternativa', client.altAddress]] : [])].forEach(([label, value]) => {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value;
    facts.append(dt, dd);
  });
  const source = document.createElement('small');
  const accuracy = Number(client.location?.accuracy);
  const takenAt = client.location?.capturedAt ? new Date(client.location.capturedAt) : null;
  source.textContent = [
    SOURCE_LABELS[client.location?.source] || 'Ubicación registrada',
    Number.isFinite(accuracy) && accuracy > 0 ? `± ${Math.round(accuracy)} m${accuracy > 100 ? ' (aproximada)' : ''}` : '',
    takenAt && !Number.isNaN(takenAt.getTime()) ? takenAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
  ].filter(Boolean).join(' · ');
  const actions = document.createElement('div');
  actions.className = 'client-map-popup-actions';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'primary-button';
  open.textContent = 'Ver ficha';
  open.addEventListener('click', () => openOperationsClient(id));
  const move = document.createElement('button');
  move.type = 'button';
  move.className = 'secondary-button';
  move.textContent = 'Reubicar';
  move.addEventListener('click', () => { map.closePopup(); startPick(id); });
  actions.append(directionsLink(client.location, `el domicilio de ${client.name}`), open);
  actions.append(move);
  if (client.altAddress) actions.append(altAddressButton(id, client));
  box.append(name, tier, facts, source, actions);
  return box;
}

/** Muestra en el mapa SOLO la dirección alternativa de este cliente (oculta cualquier otra). */
function showAltLocation(id) {
  const L = window.L;
  const client = clients[id];
  hideAltLocation();
  if (!L || !client || !hasCoordinates(client.altLocation)) return null;
  const risk = paymentBehavior(client);
  altLayer ||= L.layerGroup().addTo(map);
  shownAltClientId = id;
  return L.circleMarker([Number(client.altLocation.latitude), Number(client.altLocation.longitude)], {
    radius: 7, weight: 3, color: TIER_COLORS[risk.tier], fillColor: '#FFFFFF', fillOpacity: 0.95, dashArray: '3 3'
  })
    .bindTooltip(`${client.name} · dirección alternativa`, { direction: 'top', offset: [0, -6] })
    .bindPopup(() => altPopupContent(id, client, risk), { minWidth: 230 })
    .addTo(altLayer);
}

/** Oculta la dirección alternativa visible (al pasar a otro cliente o cambiar de cobro). */
function hideAltLocation() {
  altLayer?.clearLayers();
  shownAltClientId = null;
}

/** Botón "Dirección alternativa": lleva a esa ubicación o, si aún no está ubicada, permite marcarla. */
/**
 * Botón "Cómo llegar": abre Google Maps con la ruta desde la ubicación actual hasta el
 * punto del cliente. En el celular abre la app de Google Maps lista para navegar.
 */
function directionsLink(location, label) {
  const link = document.createElement('a');
  link.className = 'map-action client-map-directions';
  link.href = `https://www.google.com/maps/dir/?api=1&destination=${Number(location.latitude)},${Number(location.longitude)}&travelmode=driving`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.innerHTML = '<span aria-hidden="true">➤</span><span class="map-action-label">Cómo llegar · Google Maps</span>';
  link.setAttribute('aria-label', `Cómo llegar a ${label} en Google Maps`);
  return link;
}

function altAddressButton(id, client) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-action client-map-alt-button';
  const located = hasCoordinates(client.altLocation);
  button.innerHTML = `<span aria-hidden="true">⇄</span><span class="map-action-label">${located ? 'Ir a dirección alternativa' : 'Ubicar dirección alternativa'}</span>`;
  button.title = client.altAddress;
  button.addEventListener('click', () => {
    map.closePopup();
    if (located) {
      const altMarker = showAltLocation(id);
      focusLocation(client.altLocation, () => altMarker?.openPopup());
    }
    else startPick(id, 'alt');
  });
  return button;
}

/** Ficha rápida del punto de la dirección alternativa, con regreso al domicilio. */
function altPopupContent(id, client, risk) {
  const box = document.createElement('div');
  box.className = 'client-map-popup';
  const name = document.createElement('strong');
  name.textContent = client.name;
  const kind = document.createElement('span');
  kind.className = 'client-map-popup-tier';
  kind.style.setProperty('--tier-color', TIER_COLORS[risk.tier]);
  kind.textContent = 'Dirección alternativa';
  const address = document.createElement('small');
  address.textContent = client.altAddress || '—';
  const actions = document.createElement('div');
  actions.className = 'client-map-popup-actions';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'map-action client-map-alt-button';
  back.innerHTML = '<span aria-hidden="true">⌂</span><span class="map-action-label">Ir al domicilio</span>';
  back.disabled = !hasCoordinates(client.location);
  back.addEventListener('click', () => { map.closePopup(); focusLocation(client.location, () => markersById.get(id)?.openPopup()); });
  const move = document.createElement('button');
  move.type = 'button';
  move.className = 'secondary-button';
  move.textContent = 'Reubicar';
  move.addEventListener('click', () => { map.closePopup(); startPick(id, 'alt'); });
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'primary-button';
  open.textContent = 'Ver ficha';
  open.addEventListener('click', () => openOperationsClient(id));
  if (hasCoordinates(client.altLocation)) actions.append(directionsLink(client.altLocation, `la dirección alternativa de ${client.name}`));
  actions.append(open);
  actions.append(move);
  actions.append(back);
  box.append(name, kind, address, actions);
  return box;
}

function focusLocation(location, afterMove) {
  if (!hasCoordinates(location)) return;
  map.flyTo([Number(location.latitude), Number(location.longitude)], FOCUS_ZOOM, { duration: 0.6 });
  if (afterMove) map.once('moveend', afterMove);
}

function ensureMap(L) {
  if (map) return;
  map = L.map('client-map-canvas', { zoomControl: true, attributionControl: true, minZoom: 5, maxBounds: L.latLngBounds(COLOMBIA_BOUNDS).pad(0.6) });
  // El recorrido va en su propio plano, debajo de los clientes (los puntos siguen clicables).
  map.createPane('trackPane').style.zIndex = 350;
  trackLayer = L.layerGroup().addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  setupBasemaps(L);
  // Si el mapa se creó o encuadró con el panel oculto, recalcula al hacerse visible.
  new ResizeObserver(() => {
    if (!canvasHasSize()) return;
    map.invalidateSize();
    if (pendingFit) fitView(L, pendingFit);
  }).observe($('#client-map-canvas'));
  map.on('click', event => {
    if (!pickClientId || !clients[pickClientId]) return;
    const client = clients[pickClientId];
    // El trabajador también puede ubicar/reubicar (domicilio y dirección alternativa) de su cobro.
    const point = { latitude: event.latlng.lat, longitude: event.latlng.lng, source: isWorkerMap() ? 'trabajador' : 'admin', capturedAt: new Date().toISOString(), by: isWorkerMap() ? state.activeWorker?.name || 'Trabajador' : 'Administrador' };
    const isAlt = pickKind === 'alt';
    if (isAlt) client.altLocation = point; else client.location = point;
    const firstInRoute = !isAlt && !routeEntries(client.route).some(entry => entry.id !== pickClientId && hasCoordinates(entry.client.location));
    persistBusinessData();
    showToast(isAlt ? `Dirección alternativa de ${client.name} guardada.` : `Ubicación de ${client.name} guardada.`);
    const placedId = pickClientId;
    endPick();
    // Recién ubicada, la dirección alternativa se deja visible para confirmar dónde quedó.
    renderClientMap({ refit: firstInRoute }).then(() => { if (isAlt) showAltLocation(placedId); });
  });
}

function setupBasemaps(L) {
  const layers = Object.fromEntries(Object.entries(BASEMAPS).map(([name, build]) => [name, build(L)]));
  let saved = 'Calles';
  try { saved = localStorage.getItem(BASEMAP_STORAGE_KEY) || 'Calles'; } catch { /* preferencia opcional */ }
  (layers[saved] || layers['Calles']).addTo(map);
  L.control.layers(layers, null, { position: 'topright', collapsed: true }).addTo(map);
  map.on('baselayerchange', event => {
    try { localStorage.setItem(BASEMAP_STORAGE_KEY, event.name); } catch { /* preferencia opcional */ }
  });
}

function boundsAround(L, lat, lng, span) {
  return L.latLngBounds([lat - span, lng - span], [lat + span, lng + span]);
}

/**
 * Encuadre del cobro, de lo más preciso a lo más general:
 * 1) clientes ubicados (perímetro mínimo ~1 km), 2) zona guardada del cobro
 * (municipio del trabajador o vista fijada a mano), 3) municipio buscado en línea,
 * 4) departamento, 5) Colombia.
 */
async function resolveFocus(L, { routeId, entries, worker, department }) {
  const located = entries.filter(entry => hasCoordinates(entry.client.location));
  if (located.length === 1) {
    const { client } = located[0];
    return { center: [Number(client.location.latitude), Number(client.location.longitude)], zoom: 15, label: `1 cliente ubicado (${client.name})` };
  }
  if (located.length > 1) {
    const lats = located.map(({ client }) => Number(client.location.latitude));
    const lngs = located.map(({ client }) => Number(client.location.longitude));
    const [south, north, west, east] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const span = Math.max(MIN_SPAN, (north - south) / 2, (east - west) / 2);
    return { bounds: boundsAround(L, (south + north) / 2, (west + east) / 2, span), maxZoom: 16, label: `${located.length} clientes ubicados` };
  }
  const route = routeSettlements[routeId];
  let zone = route?.mapZone;
  if (!zone && worker?.city) {
    zone = await geocodeMunicipality(worker.city, department?.name);
    if (zone && route) { route.mapZone = { ...zone, source: 'municipio' }; persistBusinessData(); }
  }
  if (zone) return { bounds: L.latLngBounds([zone.bbox[0], zone.bbox[1]], [zone.bbox[2], zone.bbox[3]]), maxZoom: 14, label: zone.source === 'manual' ? 'zona fijada para este cobro' : `municipio de ${zone.label}` };
  if (department && worker?.city && worker.city.toLocaleLowerCase('es') === department.capital.toLocaleLowerCase('es')) {
    return { center: department.center, zoom: 12, label: `ciudad de ${department.capital}` };
  }
  if (department) return { bounds: L.latLngBounds([department.bbox[0], department.bbox[1]], [department.bbox[2], department.bbox[3]]), maxZoom: 10, label: `departamento de ${department.name} (no se encontró el municipio: usa "Fijar zona")` };
  return { bounds: L.latLngBounds(COLOMBIA_BOUNDS), maxZoom: 6, label: 'Colombia (el cobro no tiene clientes ubicados ni zona asignada)' };
}

function canvasHasSize() {
  const box = $('#client-map-canvas').getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

async function fitView(L, context) {
  if (!canvasHasSize()) { pendingFit = context; return; } // se reintenta al volverse visible
  pendingFit = null;
  map.invalidateSize();
  const focus = await resolveFocus(L, context);
  if (mapRouteId() !== context.routeId) return;
  if (focus.center) map.setView(focus.center, focus.zoom, { animate: false });
  else map.fitBounds(focus.bounds, { padding: [48, 48], maxZoom: focus.maxZoom, animate: false });
  focusedClientId = null;
  document.querySelectorAll('#client-map-located [data-map-focus]').forEach(row => row.setAttribute('aria-pressed', 'false'));
  $('#client-map-focus').textContent = `Encuadre: ${focus.label}.`;
  lastFitKey = context.routeId;
}

function renderLocatedList(entries) {
  const located = entries.filter(entry => hasCoordinates(entry.client.location));
  $('#client-map-located-count').textContent = String(located.length);
  const list = $('#client-map-located');
  list.replaceChildren();
  if (!located.length) {
    const empty = document.createElement('p');
    empty.className = 'client-map-empty';
    empty.textContent = 'Aún no hay clientes ubicados en este cobro.';
    list.append(empty);
    return;
  }
  located.sort((a, b) => a.client.name.localeCompare(b.client.name, 'es')).forEach(({ id, client, risk }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'client-map-located-row';
    button.dataset.mapFocus = id;
    button.setAttribute('aria-pressed', String(id === focusedClientId));
    const dot = document.createElement('i');
    dot.className = 'client-map-dot';
    dot.style.setProperty('--tier-color', TIER_COLORS[risk.tier]);
    dot.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = client.name;
    button.append(dot, name);
    button.setAttribute('aria-label', `Ver a ${client.name} en el mapa`);
    list.append(button);
  });
}

/** Acerca el mapa a un cliente concreto y abre su ficha rápida. */
function focusClient(clientId) {
  const client = clients[clientId];
  if (!map || !client || !hasCoordinates(client.location)) return;
  const tier = paymentBehavior(client).tier;
  if (!visibleTiers.has(tier)) { // si su color está filtrado, se vuelve a mostrar
    visibleTiers.add(tier);
    const input = document.querySelector(`#client-map-legend input[value="${tier}"]`);
    if (input) input.checked = true;
    renderClientMap({ refit: false }).then(() => focusClient(clientId));
    return;
  }
  focusedClientId = clientId;
  if (shownAltClientId && shownAltClientId !== clientId) hideAltLocation();
  document.querySelectorAll('#client-map-located [data-map-focus]').forEach(row => row.setAttribute('aria-pressed', String(row.dataset.mapFocus === clientId)));
  map.flyTo([Number(client.location.latitude), Number(client.location.longitude)], FOCUS_ZOOM, { duration: 0.6 });
  map.once('moveend', () => markersById.get(clientId)?.openPopup());
  $('#client-map-focus').textContent = `Encuadre: ${client.name}.`;
}

/** Pinta la sección completa. refit=false conserva el encuadre actual (filtros, reubicar). */
async function renderClientMap({ refit = true } = {}) {
  attachMapHost();
  const routeId = mapRouteId();
  const route = routeSettlements[routeId];
  const worker = workerForRoute(routeId);
  const department = findDepartment(worker?.department);
  $('#client-map-route').textContent = (route?.name || routeId).toLocaleUpperCase('es');
  $('#worker-map-route').textContent = `RUTA ${(route?.name || routeId).toLocaleUpperCase('es')}`;
  $('#client-map-zone').textContent = worker
    ? `${worker.name} · ${worker.city || 'Ciudad sin registrar'}, ${department?.name || 'departamento sin registrar'}`
    : 'Sin trabajador asignado a este cobro';
  const entries = routeEntries(routeId);
  renderSidebar(entries);
  renderLocatedList(entries);

  if (!map) showMessage('Cargando mapa…');
  let L;
  try { L = await loadLeaflet(); }
  catch { showMessage('No se pudo cargar el mapa. Revisa la conexión a internet: la cartografía se descarga en línea.'); return; }
  if (mapRouteId() !== routeId) return; // el usuario cambió de cobro mientras cargaba
  ensureMap(L);
  showMessage(entries.length ? '' : 'Este cobro todavía no tiene clientes.');

  markerLayer.clearLayers();
  markersById.clear();
  hideAltLocation();
  entries.filter(entry => hasCoordinates(entry.client.location) && visibleTiers.has(entry.risk.tier)).forEach(({ id, client, risk }) => {
    const marker = L.circleMarker([Number(client.location.latitude), Number(client.location.longitude)], {
      radius: 9, weight: 2, color: '#FFFFFF', fillColor: TIER_COLORS[risk.tier], fillOpacity: 0.95
    })
      .bindTooltip(client.name, { direction: 'top', offset: [0, -8] })
      .bindPopup(() => popupContent(id, client, risk), { minWidth: 230 })
      .addTo(markerLayer);
    // Al abrir otro cliente, la dirección alternativa que estuviera visible se oculta.
    marker.on('popupopen', () => { if (shownAltClientId && shownAltClientId !== id) hideAltLocation(); });
    markersById.set(id, marker);
  });

  renderWorkerTrack(L, routeId, worker);

  // Leaflet necesita medir el contenedor una vez visible.
  requestAnimationFrame(() => {
    if (canvasHasSize()) map.invalidateSize();
    if (refit || lastFitKey !== routeId) fitView(L, { routeId, entries, worker, department });
  });
}

const trackTime = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

function clearTrack() {
  stopTrackFeed();
  stopTrackFeed = () => {};
  trackKey = '';
  trackPoints = [];
  trackLayer?.clearLayers();
}

/** Carga el recorrido del día (y escucha los puntos nuevos si es hoy) del trabajador del cobro. */
async function renderWorkerTrack(L, routeId, worker) {
  const card = $('#worker-track-card');
  card.hidden = isWorkerMap();
  if (isWorkerMap()) { clearTrack(); return; }
  const dateInput = $('#worker-track-date');
  dateInput.max = localDateISO();
  if (!dateInput.value) dateInput.value = localDateISO();
  trackWorker = worker;
  if (!worker) { clearTrack(); $('#worker-track-status').textContent = 'Este cobro no tiene trabajador asignado.'; $('#worker-track-stats').innerHTML = ''; return; }
  if (!$('#worker-track-toggle').checked) { clearTrack(); $('#worker-track-status').textContent = 'Recorrido oculto.'; $('#worker-track-stats').innerHTML = ''; return; }
  const day = dateInput.value;
  const key = `${worker.id}|${day}`;
  if (key !== trackKey) {
    clearTrack();
    trackKey = key;
    $('#worker-track-status').textContent = 'Cargando recorrido…';
    try { trackPoints = await loadTrack(worker.id, day); }
    catch { trackPoints = []; if (trackKey === key) $('#worker-track-status').textContent = 'No se pudo cargar el recorrido. Revisa la conexión.'; }
    if (trackKey !== key) return; // cambiaron de cobro o de día mientras cargaba
    if (day === localDateISO()) {
      stopTrackFeed = subscribeTrack(worker.id, point => {
        if (trackKey !== key) return;
        trackPoints.push(point);
        drawTrack(L);
      });
    }
  }
  drawTrack(L);
}

function drawTrack(L) {
  if (!trackLayer) return;
  trackLayer.clearLayers();
  const worker = trackWorker;
  const points = trackPoints;
  const stats = $('#worker-track-stats');
  if (!worker) return;
  if (!points.length) {
    const today = $('#worker-track-date').value === localDateISO();
    $('#worker-track-status').textContent = today ? `${worker.name} todavía no envía puntos hoy. Aparecerá aquí apenas abra la app con GPS.` : `${worker.name} no tiene recorrido ese día.`;
    stats.innerHTML = '';
    return;
  }
  const latlngs = points.map(point => [point.latitude, point.longitude]);
  L.polyline(latlngs, { pane: 'trackPane', color: '#2979FF', weight: 4, opacity: 0.85, lineJoin: 'round' }).addTo(trackLayer);
  L.circleMarker(latlngs[0], { pane: 'trackPane', radius: 5, weight: 2, color: '#FFFFFF', fillColor: '#9CA3AF', fillOpacity: 1 })
    .bindTooltip(`Inicio · ${trackTime(points[0].recordedAt)}`).addTo(trackLayer);
  const last = points[points.length - 1];
  const minutesAgo = (Date.now() - new Date(last.recordedAt)) / 60000;
  const live = $('#worker-track-date').value === localDateISO() && minutesAgo <= LIVE_MINUTES;
  L.marker(latlngs[latlngs.length - 1], {
    icon: L.divIcon({ className: `worker-live-marker${live ? ' is-live' : ''}`, html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
    zIndexOffset: 1000, keyboard: false,
  }).bindTooltip(`${worker.name} · ${trackTime(last.recordedAt)}${last.accuracy ? ` · ± ${Math.round(last.accuracy)} m` : ''}`, { direction: 'top', offset: [0, -10] }).addTo(trackLayer);
  const meters = points.slice(1).reduce((sum, point, index) => sum + trackDistance(points[index], point), 0);
  $('#worker-track-status').textContent = live
    ? `En vivo · última señal hace ${Math.max(0, Math.round(minutesAgo))} min`
    : `Última señal: ${trackTime(last.recordedAt)}${$('#worker-track-date').value === localDateISO() ? ` (hace ${Math.round(minutesAgo)} min)` : ''}`;
  $('#worker-track-status').classList.toggle('is-live', live);
  stats.innerHTML = [
    ['Recorrido', meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(meters)} m`],
    ['Primera señal', trackTime(points[0].recordedAt)],
    ['Última señal', trackTime(last.recordedAt)],
    ['Puntos', String(points.length)],
  ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
}

function startPick(clientId, kind = 'main') {
  const client = clients[clientId];
  if (!client || !map) return;
  pickClientId = clientId;
  pickKind = kind;
  const current = kind === 'alt' ? client.altLocation : client.location;
  if (hasCoordinates(current)) map.flyTo([Number(current.latitude), Number(current.longitude)], FOCUS_ZOOM, { duration: 0.5 });
  $('#client-map-banner-text').textContent = kind === 'alt'
    ? `Haz clic en el mapa sobre la dirección alternativa de ${client.name} (${client.altAddress}).`
    : `Haz clic en el mapa sobre el domicilio de ${client.name}.`;
  $('#client-map-banner').hidden = false;
  $('#client-map-canvas').classList.add('is-picking');
  document.querySelectorAll('#client-map-missing [data-map-pick]').forEach(button => {
    const active = button.dataset.mapPick === clientId;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? 'Ubicando…' : 'Ubicar';
  });
}

function endPick() {
  pickClientId = null;
  pickKind = 'main';
  $('#client-map-banner').hidden = true;
  $('#client-map-canvas').classList.remove('is-picking');
  document.querySelectorAll('#client-map-missing [data-map-pick]').forEach(button => {
    button.classList.remove('is-active');
    button.setAttribute('aria-pressed', 'false');
    button.textContent = 'Ubicar';
  });
}

/** Confirmación breve en el propio botón (✓ + texto) para saber que la acción se ejecutó. */
function flashDone(button, text) {
  const label = button.querySelector('.map-action-label');
  if (!label) return;
  window.clearTimeout(button._doneTimer);
  button.dataset.label ||= label.textContent;
  label.textContent = text;
  button.classList.add('is-done');
  button._doneTimer = window.setTimeout(() => {
    button.classList.remove('is-done');
    label.textContent = button.dataset.label;
  }, 1600);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_clientMapModule() {
  $('#client-map-legend').addEventListener('change', event => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;
    if (input.checked) visibleTiers.add(input.value); else visibleTiers.delete(input.value);
    renderClientMap({ refit: false });
  });
  $('#client-map-missing').addEventListener('click', event => {
    const button = event.target.closest('[data-map-pick]');
    if (button) startPick(button.dataset.mapPick);
  });
  $('#client-map-cancel-pick').addEventListener('click', endPick);
  $('#client-map-located').addEventListener('click', event => {
    const button = event.target.closest('[data-map-focus]');
    if (button) focusClient(button.dataset.mapFocus);
  });
  $('#client-map-fit').addEventListener('click', event => {
    renderClientMap({ refit: true });
    flashDone(event.currentTarget, 'Vista centrada');
  });
  $('#client-map-save-zone').addEventListener('click', () => {
    const route = routeSettlements[mapRouteId()];
    if (!map || !route || isWorkerMap()) return;
    const bounds = map.getBounds();
    route.mapZone = { bbox: [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()], label: route.name, source: 'manual' };
    persistBusinessData();
    $('#client-map-focus').textContent = 'Encuadre: zona fijada para este cobro.';
    flashDone($('#client-map-save-zone'), 'Zona guardada');
    showToast(`Zona del cobro ${route.name} guardada. El mapa abrirá aquí mientras no tenga clientes ubicados.`);
  });
  $('#worker-track-toggle').addEventListener('change', () => renderClientMap({ refit: false }));
  $('#worker-track-date').addEventListener('change', () => renderClientMap({ refit: false }));
  $('#worker-track-focus').addEventListener('click', () => {
    const last = trackPoints[trackPoints.length - 1];
    if (!map || !last) { showToast('Todavía no hay recorrido para mostrar.'); return; }
    map.flyTo([last.latitude, last.longitude], FOCUS_ZOOM, { duration: 0.6 });
  });
  // «hace N min» y el estado en vivo se recalculan solos mientras el mapa está abierto.
  window.setInterval(() => {
    if (window.L && trackPoints.length && state.activeAdminPanel === 'map') drawTrack(window.L);
  }, 30000);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && pickClientId && (state.activeAdminPanel === 'map' || state.currentView === 'mapa')) endPick();
  });
}

// ── js/features/admin/evidence.js
/**
 * features/admin/evidence · Comprobantes por día: transferencias y otros gastos.
 * Muestra también los registros SIN comprobante, marcados con un indicador, para que
 * el admin pueda auditarlos (antes las transferencias sin foto pasaban desapercibidas).
 */









let selectedDate = '';
const qs = selector => document.querySelector(selector);

function evidenceDate() {
  return selectedDate || localDateISO();
}

/** Tarjeta común: monto, descripción y miniatura del comprobante o indicador de faltante. */
function evidenceItem({ amount, title, detail, receiptData, receiptLabel }) {
  const item = document.createElement('article');
  item.className = 'expense-evidence-item';
  item.classList.toggle('is-missing-evidence', !receiptData);
  const details = document.createElement('div');
  const value = document.createElement('strong');
  value.textContent = formatMoney(amount);
  const name = document.createElement('span');
  name.className = 'evidence-title';
  name.textContent = title;
  const meta = document.createElement('span');
  meta.textContent = detail;
  details.append(value, name, meta);
  if (receiptData) {
    const receipt = bindImageViewer(document.createElement('button'), { src: receiptData, title: `${formatMoney(amount)} · ${title}`, caption: detail });
    receipt.type = 'button';
    receipt.className = 'expense-receipt-link';
    receipt.setAttribute('aria-label', `Ver ${receiptLabel}`);
    const image = document.createElement('img');
    image.className = 'evidence-thumbnail';
    image.src = receiptData;
    image.alt = receiptLabel;
    const label = document.createElement('span');
    label.textContent = 'Ampliar';
    receipt.append(image, label);
    item.append(details, receipt);
  } else {
    const missing = document.createElement('span');
    missing.className = 'evidence-missing-badge';
    missing.setAttribute('role', 'status');
    missing.innerHTML = '<span aria-hidden="true">!</span>Sin comprobante';
    item.append(details, missing);
  }
  return item;
}

function renderList(list, summary, items, emptyText) {
  list.replaceChildren();
  const missing = items.filter(item => !item.receiptData).length;
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  summary.replaceChildren();
  if (items.length) {
    const amount = document.createElement('strong');
    amount.className = 'evidence-total';
    amount.textContent = `Total ${formatMoney(total)}`;
    summary.append(amount, ` · ${items.length} ${items.length === 1 ? 'registro' : 'registros'}${missing ? ` · ${missing} sin comprobante` : ' · todos con comprobante'}`);
  }
  summary.classList.toggle('has-missing', missing > 0);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'expense-evidence-empty';
    empty.textContent = emptyText;
    list.append(empty);
    return;
  }
  // Primero los que no tienen comprobante: son los que requieren atención.
  items.sort((a, b) => Number(Boolean(a.receiptData)) - Number(Boolean(b.receiptData)) || String(b.sortKey).localeCompare(String(a.sortKey)));
  items.forEach(item => list.append(evidenceItem(item)));
}

function renderTransferEvidence(routeId, date) {
  const worker = workerForRoute(routeId);
  const items = Object.values(clients).flatMap(client => client.route === routeId
    ? (client.payments || []).filter(payment => payment.method === 'transfer' && payment.date === date).map(payment => ({
      amount: payment.amount,
      title: client.name,
      detail: `${formatDate(payment.date)}${worker ? ` · Cobró ${worker.name}` : ''}`,
      receiptData: payment.receiptData || '',
      receiptLabel: `comprobante de transferencia de ${client.name}`,
      sortKey: payment.createdAt || payment.date
    }))
    : []);
  renderList(qs('#admin-transfer-evidence-list'), qs('#transfer-evidence-summary'), items, 'No hay transferencias registradas en esta fecha.');
}

function renderOtherExpenseEvidence(route, date) {
  const items = (route.otherExpenseEntries || []).filter(entry => (entry.date || String(entry.createdAt).slice(0, 10)) === date).map(entry => ({
    amount: entry.amount,
    title: entry.note || 'Gasto sin descripción',
    detail: `${entry.workerName || 'Trabajador'} · ${formatDate(entry.date)}`,
    receiptData: entry.receiptData || '',
    receiptLabel: `comprobante de ${formatMoney(entry.amount)}: ${entry.note}`,
    sortKey: entry.createdAt
  }));
  renderList(qs('#admin-other-expense-list'), qs('#expense-evidence-summary'), items, 'No hay otros gastos registrados en esta fecha.');
  renderOtherExpenseComment(route, date);
}

/** Comentario de otros gastos del día: es el mismo que sale en Reportes financieros. */
function renderOtherExpenseComment(route, date) {
  const note = otherExpensesNote(route, date);
  const text = qs('#other-expense-comment-text');
  text.textContent = note ? `Comentario: ${note}` : 'Sin comentario para los reportes financieros.';
  text.classList.toggle('is-empty', !note);
  qs('#other-expense-comment-button').textContent = note ? '💬 Editar comentario' : '💬 Agregar comentario';
}

function openOtherExpenseComment() {
  const route = routeSettlements[routeSelect.value];
  if (!route) return;
  const date = evidenceDate();
  const day = new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: '2-digit' });
  openCustomModal({
    title: `Comentario de otros gastos · ${day}`,
    description: `Ruta ${route.name}. Este comentario aparece en Reportes financieros, en «Otros gastos» de ese día.`,
    fields: [{ name: 'note', label: 'Comentario', type: 'textarea', rows: 4, value: otherExpensesNote(route, date), placeholder: 'Ej. Pinchada $ 12.000, gasolina $ 20.000' }],
    submitLabel: 'Guardar comentario',
    onSubmit: values => {
      setOtherExpensesNote(route, date, values.note);
      persistBusinessData();
      renderOtherExpenseComment(route, date);
      showToast('Comentario guardado. Ya sale en Reportes financieros.');
    },
  });
}

function renderRouteEvidence(routeId) {
  const route = routeSettlements[routeId];
  if (!route) return;
  const date = evidenceDate();
  qs('#receipts-route-name').textContent = route.name.toLocaleUpperCase('es');
  qs('#receipts-date-input').value = date;
  qs('#receipts-today').disabled = date === localDateISO();
  renderTransferEvidence(routeId, date);
  renderOtherExpenseEvidence(route, date);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_evidenceModule() {
  qs('#receipts-date-input').addEventListener('change', event => {
    selectedDate = event.target.value || '';
    renderRouteEvidence(routeSelect.value);
  });
  qs('#other-expense-comment-button').addEventListener('click', openOtherExpenseComment);
  qs('#receipts-today').addEventListener('click', () => {
    selectedDate = '';
    renderRouteEvidence(routeSelect.value);
  });
}

// ── js/features/admin/legacy-import.js
/**
 * features/admin/legacy-import · «Importar cartera del sistema anterior» (Configuración del admin).
 *
 * El admin elige el .json que genera tools/migracion/exportar-cobro.ps1 y el cobro de destino;
 * ve el resumen (créditos, capital, saldos, abonos y datos por corregir) y solo al confirmar
 * se crean las cartulinas. Las que ya se importaron antes no se tocan, así no se pierden
 * abonos registrados después en EdgeCredit. No mueve la caja ni la liquidación de hoy.
 */









let legacyRaw = null;
let legacyFileName = '';
// Nombre limpio y referencia por crédito: del archivo de correcciones y de lo que el admin escriba.
let legacyNames = {};

const legacyPreview = () => document.querySelector('#legacy-import-preview');

function closeLegacyPreview() {
  legacyRaw = null;
  legacyNames = {};
  legacyPreview().hidden = true;
  legacyPreview().innerHTML = '';
  document.querySelector('#legacy-import-file').value = '';
}

function renderLegacyPreview() {
  const box = legacyPreview();
  const routes = Object.entries(routeSettlements);
  if (!routes.length) {
    box.innerHTML = '<p class="legacy-import-error">Primero crea el cobro: registra a su trabajador en Gestión de Personal con esa ruta.</p><div class="legacy-import-actions"><button class="secondary-button" type="button" data-legacy-cancel>Cerrar</button></div>';
    box.hidden = false;
    return;
  }
  const chosen = box.querySelector('#legacy-import-route')?.value;
  const guess = routeKey(String(legacyRaw.cobro?.COB_CODIGO || ''));
  const routeId = routeSettlements[chosen] ? chosen : routeSettlements[guess] ? guess : routeSelect.value || routes[0][0];
  const result = convertLegacyExport(legacyRaw, routeId, undefined, legacyNames);
  const existing = result.cards.filter(card => clients[card.clientId]);
  const fresh = result.cards.filter(card => !clients[card.clientId]);
  const warningCount = result.cards.reduce((sum, card) => sum + card.warnings.length, 0);
  const rows = result.cards.map(({ code, clientId, client, warnings, legacyName, reference }) => `
    <tr${clients[clientId] ? ' class="is-existing"' : ''}>
      <td class="legacy-name-cell"><strong>${escapeHTML(code)}</strong>
        <input class="legacy-name-input" type="text" data-legacy-code="${escapeHTML(code)}" value="${escapeHTML(client.name)}" aria-label="Nombre del cliente del crédito ${escapeHTML(code)}" maxlength="80">
        ${client.name !== legacyName ? `<small>Sistema: ${escapeHTML(legacyName)}</small>` : ''}${reference ? `<small>Referencia: ${escapeHTML(reference)}</small>` : ''}</td>
      <td>${formatMoney(client.principal)}</td>
      <td>${formatMoney(client.total)}</td>
      <td>${escapeHTML(paymentFrequencyLabels[client.frequency])} · ${client.installments} × ${formatMoney(client.installment)}</td>
      <td>${client.payments.length}</td>
      <td><strong>${formatMoney(client.balance)}</strong></td>
      <td>${clients[clientId] ? '<span class="legacy-tag">Ya importado</span>' : ''}${client.paymentWarning ? '<span class="legacy-tag is-alert">CLAVO</span>' : ''}${warnings.map(text => `<small class="legacy-warning">${escapeHTML(text)}</small>`).join('')}</td>
    </tr>`).join('');
  const rejected = result.rejected.map(item => `<li><strong>${escapeHTML(item.code)}</strong>: ${escapeHTML(item.error)}</li>`).join('');
  box.innerHTML = `
    <header class="legacy-import-head">
      <div><p class="eyebrow">VISTA PREVIA · ${escapeHTML(legacyFileName)}</p><h3>Cobro ${escapeHTML(result.cobro || 'sin nombre')}${result.worker ? ` · ${escapeHTML(result.worker)}` : ''}</h3></div>
      <div class="legacy-import-tools"><button class="secondary-button" type="button" id="legacy-names-open">Cargar nombres corregidos</button><input type="file" id="legacy-names-file" accept=".json,application/json" hidden></div>
      <label class="legacy-import-route">Cargar en el cobro<select id="legacy-import-route" class="route-select">${routes.map(([id, route]) => `<option value="${escapeHTML(id)}"${id === routeId ? ' selected' : ''}>${escapeHTML(route.name || id)}</option>`).join('')}</select></label>
    </header>
    <dl class="legacy-import-totals">
      <div><dt>Créditos</dt><dd>${result.totals.count}</dd></div>
      <div><dt>Personas</dt><dd>${result.totals.people}</dd></div>
      <div><dt>Capital prestado</dt><dd>${formatMoney(result.totals.principal)}</dd></div>
      <div><dt>Abonado (${result.totals.payments} abonos)</dt><dd>${formatMoney(result.totals.paid)}</dd></div>
      <div><dt>Saldo pendiente</dt><dd>${formatMoney(result.totals.balance)}</dd></div>
      <div><dt>Datos por revisar</dt><dd>${warningCount}</dd></div>
    </dl>
    <p class="legacy-import-note">Puedes corregir el nombre de cada cliente en la tabla. El nombre del sistema anterior y la referencia quedan en las notas del cliente.</p>
    <p class="legacy-import-note">Los abonos entran como efectivo y el seguro (10 %) como cobrado en el sistema anterior. Nada de esto suma a la caja ni a la liquidación de hoy.</p>
    ${rejected ? `<div class="legacy-import-error"><strong>No se importan:</strong><ul>${rejected}</ul></div>` : ''}
    <div class="legacy-import-table-wrap"><table class="legacy-import-table">
      <thead><tr><th>Crédito / cliente</th><th>Capital</th><th>Total</th><th>Cuotas</th><th>Abonos</th><th>Saldo</th><th>Observaciones</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${existing.length ? `<p class="legacy-import-note">${existing.length} crédito(s) ya estaban importados y no se modificarán.</p>` : ''}
    <div class="legacy-import-actions">
      <button class="secondary-button" type="button" data-legacy-cancel>Cancelar</button>
      <button class="primary-button" type="button" id="legacy-import-confirm"${fresh.length ? '' : ' disabled'}>Importar ${fresh.length} crédito(s) <span aria-hidden="true">→</span></button>
    </div>`;
  box.hidden = false;
  box.querySelector('#legacy-import-route').addEventListener('change', renderLegacyPreview);
  // Solo se guarda lo escrito (sin repintar): repintar a mitad de un clic se tragaría el clic en «Importar».
  box.querySelectorAll('.legacy-name-input').forEach(input => input.addEventListener('input', () => {
    const code = input.dataset.legacyCode;
    legacyNames[code] = { ...legacyNames[code], name: input.value.trim() };
  }));
  const namesFile = box.querySelector('#legacy-names-file');
  box.querySelector('#legacy-names-open').addEventListener('click', () => namesFile.click());
  namesFile.addEventListener('change', () => readLegacyNames(namesFile.files?.[0]));
  box.querySelector('#legacy-import-confirm').addEventListener('click', () => {
    // Se convierte otra vez con los nombres que haya en pantalla en este momento.
    const latest = convertLegacyExport(legacyRaw, routeId, undefined, legacyNames).cards.filter(card => !clients[card.clientId]);
    importLegacyCards(latest, routeSettlements[routeId]?.name || routeId);
  });
}

/** Archivo de correcciones de nombres: rellena los nombres limpios y las referencias. */
async function readLegacyNames(file) {
  if (!file) return;
  try {
    const loaded = legacyCorrections(JSON.parse((await legacyFileText(file)).replace(/^\uFEFF/, '')));
    legacyNames = { ...legacyNames, ...loaded };
    renderLegacyPreview();
    const known = new Set((legacyRaw?.tarjetas || []).map(card => String(card?.TAR_CODIGO || '').trim().toUpperCase()));
    const matched = Object.keys(loaded).filter(code => known.has(code)).length;
    showToast(`Nombres corregidos: ${matched} de ${Object.keys(loaded).length} coinciden con este cobro.`);
  } catch (error) {
    showToast(error instanceof SyntaxError ? 'El archivo de nombres no es un JSON válido.' : error.message || 'No se pudo leer el archivo de nombres.');
  }
}

function importLegacyCards(cards, routeName) {
  cards.forEach(({ clientId, client }) => {
    if (clients[clientId]) return;
    clients[clientId] = client;
    appendClientCards(clientId, { refresh: false });
  });
  persistBusinessData();
  filterClientCards();
  if (routeSettlements[routeSelect.value]) renderAdminRoute(routeSelect.value);
  closeLegacyPreview();
  showToast(`Se importaron ${cards.length} crédito(s) al cobro ${routeName}.`);
}

/**
 * Texto del archivo según su codificación real. El script lo escribe en UTF-8, pero si el
 * archivo se abre y se vuelve a guardar en Windows (Bloc de notas, «>» en la consola) puede
 * quedar en UTF-16 o en ANSI, y leído como UTF-8 deja de ser un JSON válido.
 */
async function legacyFileText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decode = (encoding, start = 0, fatal = false) => new TextDecoder(encoding, { fatal }).decode(bytes.subarray(start));
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return decode('utf-8', 3);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return decode('utf-16le', 2);
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return decode('utf-16be', 2);
  if (bytes.length > 1 && bytes[1] === 0 && bytes[0] !== 0) return decode('utf-16le');
  if (bytes.length > 1 && bytes[0] === 0 && bytes[1] !== 0) return decode('utf-16be');
  try { return decode('utf-8', 0, true); } catch { return decode('windows-1252'); }
}

/** Error de lectura en la vista previa (queda en pantalla para poder leerlo o fotografiarlo). */
function showLegacyError(message, detail = '') {
  legacyRaw = null;
  const box = legacyPreview();
  box.innerHTML = `<div class="legacy-import-error"><strong>${escapeHTML(message)}</strong>${detail ? `<p>${escapeHTML(detail)}</p>` : ''}</div><div class="legacy-import-actions"><button class="secondary-button" type="button" data-legacy-cancel>Cerrar</button></div>`;
  box.hidden = false;
  document.querySelector('#legacy-import-file').value = '';
}

async function readLegacyFile(file) {
  if (!file) return;
  let text = '';
  try {
    text = (await legacyFileText(file)).replace(/^\uFEFF/, '').trim();
  } catch (error) {
    showLegacyError('No se pudo leer el archivo.', error.message || '');
    return;
  }
  try {
    legacyRaw = JSON.parse(text);
  } catch (error) {
    const start = text.slice(0, 1);
    const hint = !text ? 'El archivo está vacío.'
      : start !== '{' ? `El archivo no empieza como una exportación (empieza con «${start}»). Revisa que elegiste el archivo «…-edgecredit.json» y no otro.`
      : 'El archivo parece cortado o modificado. Vuelve a exportarlo con el script y súbelo sin abrirlo antes.';
    showLegacyError(`«${file.name}» no es un JSON válido (${(file.size / 1024).toFixed(1)} KB).`, `${hint} Detalle técnico: ${error.message}`);
    return;
  }
  try {
    legacyFileName = file.name;
    renderLegacyPreview();
  } catch (error) {
    showLegacyError('No se pudo preparar la vista previa.', error.message || String(error));
  }
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_legacyImportModule() {
  const input = document.querySelector('#legacy-import-file');
  document.querySelector('#legacy-import-open').addEventListener('click', () => input.click());
  input.addEventListener('change', () => readLegacyFile(input.files?.[0]));
  legacyPreview().addEventListener('click', event => { if (event.target.closest('[data-legacy-cancel]')) closeLegacyPreview(); });
}

// ── js/features/admin/pending.js
/**
 * features/admin/pending · Bandeja de solicitudes del equipo (aprobar / rechazar).
 */














const REQUEST_TITLES = { interest: 'Excepción de interés', insurance: 'Excepción de seguros', 'route-correction': 'Corrección de visita o pago', finance: 'Solicitud de financiación', retanqueo: 'Solicitud de retanqueo' };

/** Lo que pidió el trabajador al financiar o retanquear, en una línea. */
function restructureSummary(request) {
  const p = request.params || {};
  if (request.type === 'finance') return `Saldo ${formatMoney(p.balance)} · interés de financiación ${formatMoney(p.interest)}${p.percent != null ? ` (${p.percent} %)` : ''} · plazo nuevo ${p.totalDays} días · saldo nuevo ${formatMoney(Number(p.balance) + Number(p.interest))}`;
  return `Saldo ${formatMoney(p.balance)} · prestar ${formatMoney(p.extra)} más · intereses ${formatMoney(p.interest)} · seguros ${formatMoney(p.insurance)}${p.insuranceReason ? ` (${p.insuranceReason})` : ''} · plazo nuevo ${p.totalDays} días · saldo nuevo ${formatMoney(Number(p.balance) + Number(p.extra) + Number(p.interest))}`;
}

/** Aplica una financiación o un retanqueo aprobado con los parámetros del trabajador. */
function applyRestructureRequest(request) {
  const client = clients[request.clientId];
  const p = request.params || {};
  if (!client || Number(client.balance) <= 0) return 'La cartulina ya no tiene saldo: no se puede aplicar.';
  const by = `Administrador (solicitó ${request.workerName})`;
  if (request.type === 'finance') financeCard(client, { interest: Number(p.interest), totalDays: Number(p.totalDays), by });
  else {
    const values = { extra: Number(p.extra), interest: Number(p.interest), insurance: Number(p.insurance) };
    retanqueoCard(client, { ...values, insuranceReason: p.insuranceReason || '', totalDays: Number(p.totalDays), by });
    recordRetanqueoInRoute(routeSettlements[client.route], client, request.clientId, values);
  }
  return '';
}

/** Abono a corregir: el que eligió el trabajador (por su hora de registro) o el de esa fecha. */
function correctedPayment(client, request) {
  const payments = client?.payments || [];
  return (request.paymentAt && payments.find(item => item.at === request.paymentAt)) || payments.find(item => item.date === request.visitDate);
}

function renderPendingRequests() {
  pendingList.replaceChildren();
  const selectedRoute = routeSelect.value;
  const openRequests = pendingRequests.filter(request => request.status === 'pending' && routeKey(request.routeId || request.route) === selectedRoute);
  document.querySelector('#pending-count').textContent = String(openRequests.length);
  if (!openRequests.length) {
    const empty = document.createElement('p');
    empty.className = 'pending-empty';
    empty.textContent = `No hay solicitudes pendientes para la ruta ${routeSettlements[selectedRoute]?.name || selectedRoute}.`;
    pendingList.append(empty);
    return;
  }
  openRequests.forEach(request => {
    const card = document.createElement('article');
    card.className = 'pending-card';
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = REQUEST_TITLES[request.type] || 'Solicitud';
    const details = document.createElement('p');
    details.textContent = `${request.clientName} · ${routeSettlements[request.routeId || routeKey(request.route)]?.name || request.route} · Solicitó ${request.workerName}`;
    const value = document.createElement('p');
    value.className = 'pending-comment';
    value.textContent = request.type === 'finance' || request.type === 'retanqueo' ? restructureSummary(request)
      : request.type === 'route-correction' && request.paymentAmount ? `Abono del ${formatDate(request.visitDate)}: registrado ${formatMoney(request.paymentAmount)} → correcto ${formatMoney(request.requestedAmount)}. Motivo: ${request.comment || 'Sin comentario'}`
      : request.type === 'route-correction' && request.requestedAmount ? `Visita del ${formatDate(request.visitDate)} sin abono registrado → pagó ${formatMoney(request.requestedAmount)}. Motivo: ${request.comment || 'Sin comentario'}`
      : `${request.type === 'route-correction' ? 'Motivo enviado' : 'Acuerdo informado'}: ${request.comment || 'Sin comentario'}`;
    copy.append(title, details, value);
    const actions = document.createElement('div');
    actions.className = 'pending-actions';
    [['approve', 'Aprobar'], ['reject', 'Rechazar']].forEach(([action, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.pendingAction = action;
      button.dataset.pendingId = request.id;
      button.className = action === 'approve' ? 'primary-button' : 'secondary-button';
      button.textContent = label;
      actions.append(button);
    });
    card.append(copy, actions);
    pendingList.append(card);
  });
}

function resolvePendingRequest(requestId, approved, approvedValue) {
  const request = pendingRequests.find(item => item.id === requestId && item.status === 'pending');
  if (!request) return;
  if (approved && (request.type === 'finance' || request.type === 'retanqueo')) {
    const error = applyRestructureRequest(request);
    if (error) { showToast(error); return; }
    request.status = 'approved';
    request.resolvedAt = new Date().toISOString();
  } else if (approved && request.type === 'route-correction') {
    const client = clients[request.clientId];
    if (client) {
      const key = `${routeKey(request.routeId || client.route)}:${request.visitDate}`;
      state.routeVisitOutcomes[key] ||= {};
      const correctedAmount = Number(approvedValue);
      const payment = correctedPayment(client, request);
      let collectionDelta = correctedAmount;
      if (payment) {
        collectionDelta = correctedAmount - Number(payment.amount);
        client.balance = Math.max(0, Number(client.balance) + Number(payment.amount) - correctedAmount);
        payment.amount = correctedAmount;
      } else {
        client.payments ||= [];
        client.payments.unshift({ date: request.visitDate, amount: correctedAmount, method: 'cash', cycleIndex: paymentCycleIndex(client, request.visitDate), correction: true });
        client.balance = Math.max(0, Number(client.balance) - correctedAmount);
      }
      const route = routeSettlements[client.route];
      if (route) route.collections = Math.max(0, Number(route.collections || 0) + collectionDelta);
      updatePaidAmountTotal(client);
      client.settledAt = Number(client.balance) <= 0 ? client.settledAt || request.visitDate : null;
      state.routeVisitOutcomes[key][request.clientId] = 'paid';
      client.visitHistory ||= [];
      client.visitHistory = client.visitHistory.filter(item => item.date !== request.visitDate);
      client.visitHistory.push({ date: request.visitDate, outcome: 'paid' });
      syncCancelledCard(client, request.clientId, request.visitDate);
    }
    request.status = 'approved';
  } else if (approved) {
    const client = clients[request.clientId];
    if (client) {
      if (request.type === 'interest') {
        client.interestPercent = approvedValue;
        client.total = Math.round(client.principal * (1 + approvedValue / 100));
        client.balance = client.total;
        client.installment = Math.ceil(client.total / client.installments);
        client.breakdown = `${formatMoney(client.principal)} / ${formatMoney(client.total - client.principal)}`;
      } else client.insurancePercent = approvedValue;
    }
    request.status = 'approved';
  } else request.status = 'rejected';
  persistBusinessData();
  renderPendingRequests();
  if (request.type === 'finance' || request.type === 'retanqueo') {
    renderClientRows(request.clientId);
    if (request.clientId === state.activeClient && state.currentView === 'detalle-cliente') openClient(request.clientId);
    renderAdminRoute(routeSelect.value);
  }
  if (request.type === 'route-correction') {
    renderRouteBuilder();
    renderClientRows(request.clientId);
    if (request.clientId === state.activeClient && state.currentView === 'detalle-cliente') {
      openClient(request.clientId);
      renderHistory(clients[request.clientId]);
    }
    renderAdminRoute(routeSelect.value);
  }
  showToast(approved ? 'Solicitud aprobada y aplicada al cliente.' : 'Solicitud rechazada.');
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_pendingModule() {
  pendingList.addEventListener('click', event => {
    const button = event.target.closest('[data-pending-action]');
    if (!button) return;
    const { pendingAction, pendingId } = button.dataset;
    if (pendingAction === 'approve') {
      const request = pendingRequests.find(item => item.id === pendingId);
      if (!request) return;
      if (request.type === 'finance' || request.type === 'retanqueo') {
        openCustomModal({
          title: `Aprobar ${request.type === 'finance' ? 'financiación' : 'retanqueo'} · ${request.clientName}`,
          description: `${request.workerName} lo solicitó con estos valores: ${restructureSummary(request)}.${request.type === 'retanqueo' ? ' El monto extra entra hoy como préstamo en la liquidación y los seguros a la base.' : ''}`,
          submitLabel: 'Aprobar y aplicar',
          onSubmit: () => resolvePendingRequest(pendingId, true),
        });
        return;
      }
      if (request.type === 'route-correction') {
        openCustomModal({
          title: 'Revisar visita o pago',
          description: `${request.workerName} solicita corregir ${request.paymentAmount ? `el abono de ${formatMoney(request.paymentAmount)}` : 'la visita'} de ${request.clientName} (${formatDate(request.visitDate)}).${request.requestedAmount ? ` Monto que indica: ${formatMoney(request.requestedAmount)}.` : ''} Comentario: ${request.comment}`,
          fields: [{ name: 'amount', label: `Monto correcto del abono (${formatDate(request.visitDate)})`, money: true, thousands: true, type: 'number', min: 1, step: 1, required: true, value: request.requestedAmount || '', placeholder: 'Ingresa el monto acordado' }],
          submitLabel: 'Guardar monto',
          onSubmit: values => {
            const client = clients[request.clientId];
            const existingPayment = correctedPayment(client, request);
            const available = Number(client?.balance || 0) + Number(existingPayment?.amount || 0);
            if (!Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0) { customModalError.textContent = 'Ingresa un monto mayor que cero.'; return false; }
            if (Number(values.amount) > available) { customModalError.textContent = 'El monto corregido supera el saldo que puede aplicarse al crédito.'; return false; }
            resolvePendingRequest(pendingId, true, Number(values.amount));
          }
        });
        return;
      }
      openCustomModal({
        title: request.type === 'interest' ? 'Aprobar excepción de interés' : 'Aprobar excepción de seguros',
        description: `Acuerdo informado por ${request.workerName} para ${request.clientName}: ${request.comment || 'Sin comentario'}. Ingresa el porcentaje aprobado.`,
        fields: [{ name: 'approvedValue', label: 'Porcentaje aprobado (%)', type: 'number', min: 0, step: 0.1, required: true }],
        submitLabel: 'Aprobar y aplicar',
        onSubmit: values => {
          const percent = Number(values.approvedValue);
          if (!Number.isFinite(percent) || percent > 100) { customModalError.textContent = 'Ingresa un porcentaje entre 0 y 100.'; return false; }
          resolvePendingRequest(pendingId, true, percent);
        }
      });
    }
    else {
      const request = pendingRequests.find(item => item.id === pendingId);
      if (!request) return;
      openCustomModal({ title: 'Rechazar solicitud', description: request.type === 'route-correction' ? `¿Deseas rechazar la corrección solicitada para ${request.clientName}?` : request.type === 'finance' || request.type === 'retanqueo' ? `¿Deseas rechazar la solicitud de ${request.workerName} para ${request.clientName}? La cartulina queda como está.` : `¿Deseas rechazar la solicitud de ${request.clientName}? El cliente conservará los valores generales.`, submitLabel: 'Rechazar solicitud', onSubmit: () => resolvePendingRequest(pendingId, false) });
    }
  });
}

// ── js/features/admin/personnel.js
/**
 * features/admin/personnel · Gestión de personal: CRUD, credenciales, vencimientos
 * vehiculares y ubicación.
 */
















/** Tras crear, editar o eliminar personal: quita rutas sin trabajador ni clientes y repinta. */
function refreshRoutesAfterStaffChange() {
  pruneOrphanRoutes();
  syncRouteSelect();
  if (routeSettlements[routeSelect.value]) renderAdminRoute(routeSelect.value);
}

/** Llama una función de administración del servidor (supabase/schema.sql). */
async function adminRpc(name, params) {
  const db = await backend();
  const { error } = await db.rpc(name, params);
  if (error) throw new Error(backendErrorMessage(error));
}

/**
 * Ubica el municipio del trabajador y lo guarda como zona del cobro, para que el
 * mapa abra directamente ahí. Si no se encuentra, el mapa usa el departamento.
 */
function syncRouteZone(worker) {
  const route = routeSettlements[routeKey(worker.route)];
  if (!route || !worker.city) return;
  geocodeMunicipality(worker.city, worker.department).then(zone => {
    if (zone) {
      route.mapZone = { ...zone, source: 'municipio' };
      showToast(`Mapa del cobro ${route.name} centrado en ${worker.city}.`);
    } else {
      if (route.mapZone?.source !== 'manual') delete route.mapZone;
      showToast(`No se encontró "${worker.city}" en el mapa. Ábrelo y usa "Fijar esta vista como zona del cobro".`);
    }
    persistBusinessData();
  });
}

function renderPersonnel() {
  personnelList.replaceChildren();
  if (!personnel.length) {
    const empty = document.createElement('p');
    empty.className = 'pending-empty';
    empty.textContent = 'No hay trabajadores registrados.';
    personnelList.append(empty);
    return;
  }
  personnel.forEach((worker, index) => {
    const blocked = worker.accessEnabled === false;
    const card = document.createElement('article');
    card.className = `personnel-card${blocked ? ' is-blocked' : ''}`;

    // Encabezado: avatar, nombre, ruta y el interruptor de acceso individual.
    const head = document.createElement('header');
    head.className = 'personnel-head';
    const avatar = document.createElement('span');
    avatar.className = 'admin-avatar';
    avatar.textContent = worker.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const title = document.createElement('div');
    title.className = 'personnel-title';
    title.innerHTML = `<strong>${escapeHTML(worker.name)}</strong><span class="personnel-route-chip">Ruta ${escapeHTML(worker.route)}</span>`;
    const access = document.createElement('label');
    access.className = 'access-switch personnel-access';
    access.title = blocked ? 'Acceso desactivado: no puede ingresar' : 'Acceso activo: desactívalo para bloquear su ingreso de inmediato';
    access.innerHTML = `<input type="checkbox" data-personnel-access="${index}" ${blocked ? '' : 'checked'} aria-label="Acceso de ${escapeHTML(worker.name)} al sistema"><span class="access-switch-track" aria-hidden="true"></span><span class="access-switch-text">${blocked ? 'Bloqueado' : 'Acceso'}</span>`;
    head.append(avatar, title, access);

    // Datos en dos columnas.
    const facts = document.createElement('dl');
    facts.className = 'personnel-facts';
    [
      ['Zona', `${worker.city || 'Ciudad sin registrar'}, ${worker.department || 'sin departamento'}`],
      ['Vehículo', `${worker.motorcycle || 'Sin registrar'} · ${worker.plate || '—'}`],
      ['Usuario', worker.username || 'pendiente'],
      ['Fondo inicial', formatMoney(worker.openingAmount || 0)],
    ].forEach(([label, value]) => {
      const item = document.createElement('div');
      item.innerHTML = `<dt>${label}</dt><dd>${escapeHTML(value)}</dd>`;
      facts.append(item);
    });

    const badges = document.createElement('div');
    badges.className = 'personnel-badges';
    const twoFactorBadge = backendEnabled()
      ? '<span class="personnel-badge is-ok">🔒 Verificación en dos pasos obligatoria</span>'
      : `<span class="personnel-badge ${worker.totpSecret ? 'is-ok' : ''}">${worker.totpSecret ? '🔒 2FA activa' : '2FA pendiente (se configura al ingresar)'}</span>`;
    badges.innerHTML = `${twoFactorBadge}${blocked ? '<span class="personnel-badge is-danger">⛔ Acceso bloqueado</span>' : ''}`;

    const expiryList = document.createElement('div');
    expiryList.className = 'vehicle-expiries';
    expiryList.append(createExpiryIndicator('SOAT', worker.soatExpiry), createExpiryIndicator('Técnico-mecánica', worker.technicalExpiry));

    // Acciones: las de uso diario en una fila pareja; las delicadas aparte.
    const button = (label, action, className = '') => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = className;
      element.innerHTML = label;
      element.dataset.personnelAction = action;
      element.dataset.personnelIndex = index;
      return element;
    };
    const actions = document.createElement('footer');
    actions.className = 'personnel-actions';
    const main = document.createElement('div');
    main.className = 'personnel-actions-main';
    main.append(
      button('<span aria-hidden="true">✎</span> Editar', 'edit'),
      button('<span aria-hidden="true">🔑</span> Credenciales', 'credentials'),
      button('<span aria-hidden="true">⌖</span> Ubicación', 'locate', 'worker-location-button'),
    );
    const extra = document.createElement('div');
    extra.className = 'personnel-actions-extra';
    if (worker.totpSecret || backendEnabled()) {
      const reset = button('Restablecer 2FA', 'reset-2fa', 'personnel-link');
      reset.title = 'Úsalo si el trabajador perdió o cambió de celular';
      extra.append(reset);
    }
    extra.append(button('Eliminar', 'delete', 'personnel-link danger-action'));
    actions.append(main, extra);

    card.append(head, facts, badges, expiryList, actions);
    personnelList.append(card);
  });
}

function createExpiryIndicator(label, dateValue) {
  const item = document.createElement('div');
  const remaining = daysUntil(dateValue);
  const level = remaining === null ? 'unknown' : remaining <= 5 ? 'critical' : remaining <= 15 ? 'warning' : remaining <= 30 ? 'soon' : 'safe';
  item.className = `expiry-indicator expiry-${level}`;
  const name = document.createElement('span');
  name.textContent = label;
  const date = document.createElement('strong');
  date.textContent = dateValue ? new Date(`${dateValue}T00:00:00`).toLocaleDateString('es-CO') : 'Sin fecha';
  const note = document.createElement('small');
  note.textContent = remaining === null ? 'Sin registrar' : remaining < 0 ? `Vencido hace ${Math.abs(remaining)} día${Math.abs(remaining) === 1 ? '' : 's'}` : remaining === 0 ? 'Vence hoy' : `Faltan ${remaining} día${remaining === 1 ? '' : 's'}`;
  item.append(name, date, note);
  return item;
}

function showVehicleExpiryAlert(worker) {
  const expiring = [
    ['SOAT', worker.soatExpiry], ['Técnico-mecánica', worker.technicalExpiry]
  ].map(([label, date]) => ({ label, date, days: daysUntil(date) })).filter(item => item.days !== null && item.days <= 5);
  if (!expiring.length) return;
  // «No recordar más» silencia el aviso para ESTAS fechas; si el admin registra una fecha
  // nueva (renovación), el recordatorio vuelve a funcionar.
  const dismissKey = expiring.map(item => `${item.label}:${item.date}`).join('|');
  if (worker.expiryAlertDismissed === dismissKey) return;
  const days = value => `${value} día${value === 1 ? '' : 's'}`;
  const message = expiring.map(item => `${item.label}: ${item.days < 0 ? `vencido hace ${days(Math.abs(item.days))}` : item.days === 0 ? 'vence hoy' : `vence en ${days(item.days)}`} (${new Date(`${item.date}T00:00:00`).toLocaleDateString('es-CO')})`).join(' · ');
  openCustomModal({
    title: 'Vencimiento vehicular próximo',
    description: `${worker.name}: ${message}. Programa la renovación para continuar operando.`,
    submitLabel: 'Entendido',
    onSubmit: () => {},
    cancelLabel: 'No recordar más',
    onCancel: () => {
      worker.expiryAlertDismissed = dismissKey;
      persistBusinessData();
      showToast('No se volverá a mostrar este aviso hasta que se registre una nueva fecha de vencimiento.');
    },
  });
}

function handlePersonnelAction(action, index) {
  const worker = personnel[index];
  if (!worker) return;
  if (action === 'delete') {
    openCustomModal({
      title: 'Eliminar trabajador', description: `¿Deseas eliminar a ${worker.name} del personal?`, submitLabel: 'Eliminar',
      onSubmit: async () => {
        if (backendEnabled()) {
          try { await adminRpc('admin_delete_user', { target: worker.id }); }
          catch (error) { customModalError.textContent = error.message; return false; }
        }
        personnel.splice(index, 1); refreshRoutesAfterStaffChange(); persistBusinessData(); renderPersonnel();
      }
    });
  } else if (action === 'edit') {
    openCustomModal({
      title: 'Editar trabajador', description: 'Actualiza el perfil, zona de trabajo, vehículo, fondo inicial y vencimientos.',
      fields: [
        { name: 'name', label: 'Nombre del trabajador', value: worker.name, required: true },
        { name: 'route', label: 'Ruta asignada', type: 'text', value: worker.route, required: true },
        { name: 'department', label: 'Departamento donde trabaja', type: 'select', options: departmentOptions(), value: worker.department || '', required: true },
        { name: 'city', label: 'Ciudad / municipio', value: worker.city || '', placeholder: 'Ej. Cúcuta', required: true },
        { name: 'motorcycle', label: 'Modelo de la moto', value: worker.motorcycle || '', required: true },
        { name: 'plate', label: 'Placa', value: worker.plate || '', required: true },
        { name: 'openingAmount', label: 'Monto de apertura del cobro ($) · solo cuenta al abrir el cobro; cambiarlo aquí no mueve la base ni la caja', type: 'number', min: 0, step: 1000, value: worker.openingAmount || 0, required: true, money: true },
        { name: 'soatExpiry', label: 'Vencimiento del SOAT', type: 'date', value: worker.soatExpiry || '', required: true },
        { name: 'technicalExpiry', label: 'Vencimiento técnico-mecánica', type: 'date', value: worker.technicalExpiry || '', required: true }
      ],
      onSubmit: values => {
        const routeId = ensureRoute(values.route);
        if (!routeId) { customModalError.textContent = 'Escribe el nombre de la ruta asignada.'; return false; }
        if (!findDepartment(values.department)) { customModalError.textContent = 'Selecciona el departamento donde trabaja.'; return false; }
        const zoneChanged = worker.city !== values.city.trim() || worker.department !== findDepartment(values.department).name || routeKey(worker.route) !== routeId;
        worker.department = findDepartment(values.department).name; worker.city = values.city.trim();
        worker.name = values.name.trim(); worker.route = routeSettlements[routeId].name; worker.motorcycle = values.motorcycle.trim();
        worker.plate = values.plate.trim().toUpperCase(); worker.openingAmount = Number(values.openingAmount);
        worker.soatExpiry = values.soatExpiry; worker.technicalExpiry = values.technicalExpiry;
        // El monto de apertura solo vale al abrir un cobro nuevo: editar al trabajador no
        // toca la base del día ni la caja de un cobro que ya está andando.
        if (routeSelect.value === routeKey(worker.route)) renderAdminRoute(routeSelect.value);
        refreshRoutesAfterStaffChange();
        persistBusinessData();
        renderPersonnel();
        if (zoneChanged || !routeSettlements[routeId]?.mapZone) syncRouteZone(worker);
      }
    });
  } else if (action === 'locate') {
    fetchWorkerLocation(worker);
  } else if (action === 'credentials') {
    openWorkerCredentialModal(worker);
  } else if (action === 'reset-2fa') {
    openCustomModal({
      title: 'Restablecer verificación en dos pasos',
      description: `${worker.name} deberá escanear un código QR nuevo con su app de autenticación en el próximo ingreso. El código anterior y los dispositivos recordados dejarán de funcionar.`,
      submitLabel: 'Restablecer',
      onSubmit: async () => {
        if (backendEnabled()) {
          try { await adminRpc('admin_reset_mfa', { target: worker.id }); }
          catch (error) { customModalError.textContent = error.message; return false; }
        }
        worker.totpSecret = null;
        worker.recoveryHashes = [];
        worker.totpLastStep = -1;
        worker.enrolledAt = null;
        worker.trustVersion = (Number(worker.trustVersion) || 0) + 1; // invalida los dispositivos recordados
        persistBusinessData();
        renderPersonnel();
        showToast(`Verificación en dos pasos de ${worker.name} restablecida.`);
      }
    });
  }
}

function openWorkerCredentialModal(worker) {
  if (state.userRole !== 'admin') return;
  openCustomModal({
    title: `Credenciales de ${worker.name}`,
    description: 'Asigna el usuario y una contraseña inicial o restablecida. El trabajador podrá usarla para ingresar.',
    fields: [
      { name: 'username', label: 'Usuario', value: worker.username, required: true },
      { name: 'newPassword', label: 'Nueva contraseña (mínimo 8 caracteres)', type: 'password', minLength: 8, required: true },
      { name: 'confirmPassword', label: 'Confirmar contraseña', type: 'password', minLength: 8, required: true }
    ],
    submitLabel: 'Guardar acceso',
    onSubmit: async values => {
      const username = values.username.trim().toLocaleLowerCase('es');
      const duplicate = personnel.some(item => item !== worker && item.username?.toLocaleLowerCase('es') === username);
      if (duplicate) { customModalError.textContent = 'Ese usuario ya está asignado a otro trabajador.'; return false; }
      if (values.newPassword !== values.confirmPassword) { customModalError.textContent = 'Las contraseñas no coinciden.'; return false; }
      try {
        if (backendEnabled()) {
          if (username !== worker.username) await adminRpc('admin_set_username', { target: worker.id, new_username: username, email_domain: AUTH_EMAIL_DOMAIN });
          await adminRpc('admin_set_password', { target: worker.id, new_password: values.newPassword });
          worker.username = username;
          persistBusinessData();
          renderPersonnel();
          showToast(`Acceso de ${worker.name} actualizado.`);
          return;
        }
        worker.username = username;
        worker.passwordHash = await hashCredential(values.newPassword);
        persistBusinessData();
        renderPersonnel();
        showToast(`Acceso de ${worker.name} actualizado.`);
      } catch (error) {
        customModalError.textContent = error.message || 'No se pudieron proteger las credenciales en este navegador.';
        return false;
      }
    }
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_personnelModule() {
  document.querySelector('#add-worker').addEventListener('click', () => {
    openCustomModal({
      title: 'Agregar trabajador', description: 'Registra su asignación, zona de trabajo, vehículo, fondo y vencimientos.',
      fields: [
        { name: 'name', label: 'Nombre del trabajador', required: true },
        { name: 'username', label: 'Usuario inicial', required: true },
        { name: 'initialPassword', label: 'Contraseña inicial (mínimo 8 caracteres)', type: 'password', minLength: 8, required: true },
        { name: 'confirmPassword', label: 'Confirmar contraseña inicial', type: 'password', minLength: 8, required: true },
        { name: 'route', label: 'Ruta asignada (nombre del cobro)', type: 'text', value: '', placeholder: 'Ej. Zulia', required: true },
        { name: 'department', label: 'Departamento donde trabaja', type: 'select', options: departmentOptions(), value: '', required: true },
        { name: 'city', label: 'Ciudad / municipio', placeholder: 'Ej. Cúcuta', required: true },
        { name: 'motorcycle', label: 'Modelo de la moto', required: true },
        { name: 'plate', label: 'Placa', required: true },
        { name: 'openingAmount', label: 'Monto de apertura del cobro ($) · si el cobro es nuevo, entra a la caja', type: 'number', min: 0, step: 1000, value: 0, required: true, money: true },
        { name: 'soatExpiry', label: 'Vencimiento del SOAT', type: 'date', required: true },
        { name: 'technicalExpiry', label: 'Vencimiento técnico-mecánica', type: 'date', required: true }
      ],
      onSubmit: async values => {
        const username = values.username.trim().toLocaleLowerCase('es');
        if (personnel.some(worker => worker.username?.toLocaleLowerCase('es') === username)) { customModalError.textContent = 'Ese usuario ya está asignado a otro trabajador.'; return false; }
        if (values.initialPassword !== values.confirmPassword) { customModalError.textContent = 'Las contraseñas no coinciden.'; return false; }
        let passwordHash;
        try { passwordHash = await hashCredential(values.initialPassword); }
        catch (error) { customModalError.textContent = error.message; return false; }
        const department = findDepartment(values.department);
        if (!department) { customModalError.textContent = 'Selecciona el departamento donde trabaja.'; return false; }
        // ¿El cobro se abre con este trabajador? Entonces su monto de apertura es el capital
        // inicial y entra a la caja. En un cobro que ya existe no toca la caja.
        const existingRoute = routeSettlements[routeKey(values.route)];
        const opensRoute = !existingRoute || (!existingRoute.cashBox?.openingDate && !Object.keys(existingRoute.ledger || {}).length && !(existingRoute.cashEntries || []).length);
        const routeId = ensureRoute(values.route);
        if (!routeId) { customModalError.textContent = 'Escribe el nombre de la ruta asignada.'; return false; }
        const worker = { id: `worker-${Date.now()}`, name: values.name.trim(), username, passwordHash, route: routeSettlements[routeId]?.name || values.route.trim(), department: department.name, city: values.city.trim(), motorcycle: values.motorcycle.trim(), plate: values.plate.trim().toUpperCase(), openingAmount: Number(values.openingAmount), soatExpiry: values.soatExpiry, technicalExpiry: values.technicalExpiry };
        if (backendEnabled()) {
          // La cuenta se crea en Supabase Auth con una función del administrador (admin_create_user); el perfil queda como trabajador de esa ruta.
          try {
            if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('El usuario solo puede tener letras, números, punto o guion (mínimo 3).');
            const db = await backend();
            const { data: newUserId, error } = await db.rpc('admin_create_user', { new_username: username, new_password: values.initialPassword, email_domain: AUTH_EMAIL_DOMAIN });
            if (error) throw error;
            if (!newUserId) throw new Error('El servidor no devolvió el usuario creado.');
            worker.id = newUserId;
            delete worker.passwordHash;
            const { passwordHash: _omit, id, username: _user, ...profileData } = worker;
            const { error: profileError } = await db.from('profiles').update({ role: 'worker', route_id: routeId, access_enabled: true, data: profileData }).eq('user_id', worker.id);
            if (profileError) throw profileError;
          } catch (error) {
            customModalError.textContent = /registered|already/i.test(String(error.message)) ? 'Ese usuario ya existe en el servidor.' : backendErrorMessage(error);
            return false;
          }
        }
        personnel.push(worker);
        if (routeSettlements[routeId]) {
          if (opensRoute) routeSettlements[routeId].base = worker.openingAmount;
          if (opensRoute && worker.openingAmount > 0) {
            addCashEntry(routeSettlements[routeId], worker.openingAmount, { note: `Apertura del cobro (${worker.name})` });
            showToast(`Cobro ${routeSettlements[routeId].name} abierto: ${formatMoney(worker.openingAmount)} entraron a la caja.`);
          }
          syncRouteSelect();
          routeSelect.value = routeId;
          renderAdminRoute(routeId);
        }
        persistBusinessData();
        renderPersonnel();
        syncRouteZone(worker);
      }
    });
  });
  // Interruptor de acceso individual: bloquea o reactiva el ingreso de un trabajador.
  personnelList.addEventListener('change', event => {
    const input = event.target.closest('[data-personnel-access]');
    if (!input) return;
    const worker = personnel[Number(input.dataset.personnelAccess)];
    if (!worker) return;
    if (input.checked) {
      worker.accessEnabled = true;
      worker.accessChangedAt = new Date().toISOString();
      persistBusinessData();
      renderPersonnel();
      showToast(`Acceso de ${worker.name} reactivado.`);
      return;
    }
    input.checked = true; // se confirma antes de bloquear
    openCustomModal({
      title: 'Desactivar acceso',
      description: `${worker.name} no podrá ingresar aunque tenga usuario, contraseña y código. Si tiene la sesión abierta en este dispositivo, se cerrará.`,
      submitLabel: 'Desactivar acceso',
      onSubmit: () => {
        worker.accessEnabled = false;
        worker.accessChangedAt = new Date().toISOString();
        persistBusinessData();
        renderPersonnel();
        showToast(`Acceso de ${worker.name} desactivado.`);
      }
    });
  });
  personnelList.addEventListener('click', event => {
    const button = event.target.closest('[data-personnel-action]');
    if (button) handlePersonnelAction(button.dataset.personnelAction, Number(button.dataset.personnelIndex));
  });
}

// ── js/features/admin/reports.js
/**
 * features/admin/reports · Reportes financieros por cobro.
 *
 * Cierre semanal: semanas de lunes a sábado dentro del mes (4 o 5). Cada fila es un día
 * del libro diario (domain/ledger): base, cobro, préstamos, gastos, otros gastos, salida
 * de caja, efectivo, descuadre y caja. Gastos, otros gastos y salida de caja se corrigen
 * en la misma tabla. La última semana del mes incluye el total del mes.
 * Cierre mensual: seguros del periodo con «Cuadrar seguros».
 */











const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DATE_PICKERS = ['#report-goto-date', '#report-goto-date-monthly'];
const COLUMNS = [
  { key: 'base', label: 'Base' },
  { key: 'collections', label: 'Cobro' },
  { key: 'loans', label: 'Préstamos' },
  { key: 'expenses', label: 'Gastos', editable: true },
  { key: 'otherExpenses', label: 'Otros gastos', editable: true },
  { key: 'cashOut', label: 'Salida de caja', editable: true },
  { key: 'cashIn', label: 'Entrada a caja' },
  { key: 'cashDelivered', label: 'Efectivo' },
];
const rq = selector => document.querySelector(selector);

let selectedWeekIndex = null; // null = semana que contiene hoy (o la primera del mes)
let targetDate = null;        // fecha resaltada con «Ir a fecha»

const shortDate = date => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
const reportRouteId = () => routeSelect.value;

/** Seguros cobrados hoy que aún no entran a un cierre. */
function liveInsurance(routeId, route) {
  const today = localDateISO();
  const since = route.lastClosure?.date === today ? Date.parse(route.lastClosure.submittedAt) : 0;
  return {
    total: insuranceCollectedOn(clients, routeId, today, since).total,
    entries: liveInsuranceEntries(clients, routeId, today, since),
  };
}

// ── Selector de fecha (uno por pestaña): define el mes y la semana que se muestran ──

let reportDate = localDateISO();

function selectedMonth() {
  return reportDate.slice(0, 7);
}

function syncDatePickers() {
  DATE_PICKERS.forEach(selector => { const input = rq(selector); if (input && input.value !== reportDate) input.value = reportDate; });
}

/**
 * Semanas del mes: los días de cobro (lunes a sábado) se cortan en cada lunes. Un mes
 * queda con 4 o 5 semanas; si el corte diera 6 (p. ej. un sábado 1 y un lunes 31), el
 * tramo más corto de los extremos se une a su vecino.
 */
function calendarWeeks(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const groups = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === 0) continue; // domingo no se cobra
    if (!groups.length || date.getDay() === 1) groups.push([]);
    groups[groups.length - 1].push({ date, iso: localDateISO(date) });
  }
  while (groups.length > 5) {
    const mergeFirst = groups[0].length <= groups[groups.length - 1].length;
    if (mergeFirst) groups.splice(0, 2, [...groups[0], ...groups[1]]);
    else groups.splice(-2, 2, [...groups[groups.length - 2], ...groups[groups.length - 1]]);
  }
  return groups.map(days => ({ days, from: days[0].iso, to: days.at(-1).iso }));
}

function renderWeekTabs(weeks, activeIndex) {
  const selector = rq('#week-selector');
  selector.style.setProperty('--week-count', String(weeks.length));
  selector.replaceChildren(...weeks.map((week, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'week-tab';
    tab.dataset.week = String(index);
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(index === activeIndex));
    tab.classList.toggle('is-active', index === activeIndex);
    const title = document.createElement('span');
    title.textContent = index === weeks.length - 1 ? `Semana ${index + 1} · total mes` : `Semana ${index + 1}`;
    const range = document.createElement('small');
    range.textContent = `${shortDate(week.days[0].date)} – ${shortDate(week.days.at(-1).date)}`;
    tab.append(title, range);
    return tab;
  }));
}

function renderRouteReports(route) {
  if (!route) return;
  ensureLedger(route);
  syncDatePickers();
  const monthValue = selectedMonth();
  document.querySelectorAll('[data-report-year]').forEach(node => { node.textContent = monthValue.slice(0, 4); });
  renderCashBox(route);
  renderWeeklyAudit(route, monthValue);
  renderMonthlyInsurance(route, monthValue);
}

// ── Caja del cobro ──

function renderCashBox(route) {
  const { opening, openingDate } = route.cashBox;
  const routeId = reportRouteId();
  const current = cashBoxAt(route, localDateISO(), liveInsurance(routeId, route).total);
  rq('#cashbox-current').textContent = current === null ? '—' : formatMoney(current);
  rq('#cashbox-current').classList.toggle('is-negative', Number(current) < 0);
  const since = openingDate ? new Date(`${openingDate}T12:00:00`).toLocaleDateString('es-CO') : '';
  rq('#cashbox-opening').textContent = !openingDate ? 'Empezó en $ 0 con el primer cierre del cobro.'
    : route.cashBox.prunedBefore === openingDate ? `Viene de ${formatMoney(opening)} el ${since} (se guardan los cierres de los últimos ${LEDGER_MONTHS_KEPT} meses).`
    : `Apertura: ${formatMoney(opening)} desde el ${since}`;
  const last = [...(route.cashEntries || [])].sort((a, b) => b.ts - a.ts)[0];
  const lastEntry = rq('#cashbox-last-entry');
  lastEntry.hidden = !last;
  if (last) lastEntry.textContent = `Última entrada: ${formatMoney(last.amount)} el ${new Date(`${last.date}T12:00:00`).toLocaleDateString('es-CO')}${last.note ? ` · ${last.note}` : ''} · ${last.by}`;
}

/** Entrada de caja: el admin inyecta capital al cobro (queda registrado con fecha y motivo). */
function openCashEntry(route) {
  if (!route) return;
  const today = localDateISO();
  openCustomModal({
    title: `Entrada de caja · ${route.name}`,
    description: 'Capital que se inyecta al cobro. Suma a la caja desde la fecha elegida y queda registrado con quién lo hizo y el motivo. No modifica los cierres.',
    fields: [
      { name: 'amount', label: 'Monto que entra a la caja ($)', type: 'number', min: 1, step: 1, value: '', required: true },
      { name: 'date', label: 'Fecha', type: 'date', value: today, min: ledgerCutoff(today), max: today, required: true },
      { name: 'note', label: 'Motivo', placeholder: 'Ej. Inyección de capital', value: '' },
    ],
    submitLabel: 'Registrar entrada',
    onSubmit: values => {
      const amount = Math.round(Number(values.amount) || 0);
      if (amount <= 0) { rq('#custom-modal-error').textContent = 'Escribe un monto mayor que cero.'; return false; }
      if (!values.date || values.date > today || values.date < ledgerCutoff(today)) { rq('#custom-modal-error').textContent = `La fecha debe estar entre el ${new Date(`${ledgerCutoff(today)}T12:00:00`).toLocaleDateString('es-CO')} y hoy.`; return false; }
      addCashEntry(route, amount, { date: values.date, by: 'Administrador', note: values.note || 'Inyección de capital' });
      persistBusinessData();
      renderRouteReports(route);
      showToast(`Entrada de ${formatMoney(amount)} registrada en la caja de ${route.name}.`);
    },
  });
}

// ── Cierre semanal ──

function moneyCell(value, { negativeClass = false } = {}) {
  const cell = document.createElement('td');
  cell.className = 'numeric';
  if (value === null || value === undefined) { cell.textContent = '—'; cell.classList.add('is-muted'); return cell; }
  cell.textContent = formatMoney(value);
  if (negativeClass && value !== 0) cell.classList.add(value < 0 ? 'is-short' : 'is-surplus');
  return cell;
}

function editableCell(dateISO, key, value, disabled) {
  const cell = document.createElement('td');
  cell.className = 'numeric editable-cell';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1000';
  input.inputMode = 'numeric';
  input.className = 'ledger-input';
  input.dataset.money = '';
  input.value = String(value || 0);
  input.dataset.date = dateISO;
  input.dataset.field = key;
  input.disabled = disabled;
  input.setAttribute('aria-label', `${COLUMNS.find(column => column.key === key).label} del ${dateISO}`);
  cell.append(input);
  return cell;
}

/** Texto completo del comentario de otros gastos de un día (lo anotado + el sueldo). */
function otherExpensesSummary(route, dateISO) {
  const salary = daySalary(route, dateISO);
  return [otherExpensesNote(route, dateISO), salary ? `Sueldo (${formatMoney(salary)})` : ''].filter(Boolean).join('\n');
}

/** Botón junto a «Otros gastos»: muestra de qué fueron y permite corregir el comentario. */
function otherExpensesNoteButton(route, dateISO, disabled) {
  const summary = otherExpensesSummary(route, dateISO);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'expense-note-button';
  button.classList.toggle('has-note', Boolean(summary));
  button.dataset.noteDate = dateISO;
  button.disabled = disabled;
  button.textContent = '💬';
  button.title = summary || 'Sin comentario: toca para agregar de qué fueron los otros gastos';
  button.setAttribute('aria-label', `Comentario de otros gastos del ${dateISO}${summary ? `: ${summary.replace(/\n/g, '; ')}` : ''}`);
  return button;
}

/** Botón junto a «Salida de caja»: comentario de a dónde o para qué salió la plata. */
function cashOutNoteButton(route, dateISO, disabled) {
  const note = cashOutNote(route, dateISO);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'expense-note-button';
  button.classList.toggle('has-note', Boolean(note));
  button.dataset.noteDate = dateISO;
  button.dataset.noteField = 'cashOut';
  button.disabled = disabled;
  button.textContent = '💬';
  button.title = note || 'Sin comentario: toca para agregar a dónde o para qué salió la plata';
  button.setAttribute('aria-label', `Comentario de salida de caja del ${dateISO}${note ? `: ${note.replace(/\n/g, '; ')}` : ''}`);
  return button;
}

function openCashOutNote(route, dateISO) {
  const day = new Date(`${dateISO}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: '2-digit' });
  openCustomModal({
    title: `Salida de caja · ${day}`,
    description: `Total del día: ${formatMoney(dayRecord(route, dateISO).cashOut)}.`,
    fields: [{ name: 'note', label: '¿A dónde o para qué salió?', type: 'textarea', rows: 4, value: cashOutNote(route, dateISO), placeholder: 'Ej. Entrega al socio $ 500.000' }],
    submitLabel: 'Guardar comentario',
    onSubmit: values => {
      setCashOutNote(route, dateISO, values.note);
      persistBusinessData();
      renderRouteReports(route);
      showToast('Comentario de salida de caja guardado.');
    },
  });
}

function openOtherExpensesNote(route, dateISO) {
  const salary = daySalary(route, dateISO);
  const day = new Date(`${dateISO}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: '2-digit' });
  openCustomModal({
    title: `Otros gastos · ${day}`,
    description: `Total del día: ${formatMoney(dayRecord(route, dateISO).otherExpenses)}.${salary ? ` Incluye el sueldo del trabajador (${formatMoney(salary)}), que se cambia en «Sueldo trabajador».` : ''}`,
    fields: [{ name: 'note', label: '¿En qué se gastó?', type: 'textarea', rows: 4, value: otherExpensesNote(route, dateISO), placeholder: 'Ej. Pinchada $ 12.000, gasolina $ 20.000' }],
    submitLabel: 'Guardar comentario',
    onSubmit: values => {
      setOtherExpensesNote(route, dateISO, values.note);
      persistBusinessData();
      renderRouteReports(route);
      showToast('Comentario de otros gastos guardado.');
    },
  });
}

/** Día al que se suma el sueldo de la semana: el sábado, o hoy si la semana va en curso. */
function salaryDate(week, today) {
  return week.to <= today ? week.to : week.from <= today ? today : null;
}

function totalsRow(label, totals, className) {
  const row = document.createElement('tr');
  row.className = className;
  const head = document.createElement('th');
  head.scope = 'row';
  head.textContent = label;
  row.append(head);
  COLUMNS.forEach(({ key }) => row.append(moneyCell(totals[key])));
  row.append(moneyCell(totals.difference, { negativeClass: true }), moneyCell(totals.cashBox));
  return row;
}

function sumDays(route, days, liveTotal) {
  const totals = Object.fromEntries(COLUMNS.map(({ key }) => [key, 0]));
  totals.difference = 0;
  days.forEach(({ iso }) => {
    const record = dayRecord(route, iso, liveTotal);
    COLUMNS.forEach(({ key }) => { totals[key] += record[key]; });
    totals.difference += ledgerDifference(record) || 0;
  });
  // La base no se suma: se muestra la del primer día del periodo.
  totals.base = days.length ? dayRecord(route, days[0].iso, liveTotal).base : 0;
  totals.cashBox = days.length ? cashBoxAt(route, days.at(-1).iso <= localDateISO() ? days.at(-1).iso : localDateISO(), liveTotal) : null;
  return totals;
}

function renderWeeklyAudit(route, monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const routeId = reportRouteId();
  const live = liveInsurance(routeId, route).total;
  const today = localDateISO();
  const weeks = calendarWeeks(monthValue);
  if (targetDate && targetDate.slice(0, 7) === monthValue) {
    // Semana que contiene la fecha (un domingo cae en la semana que terminó el sábado).
    selectedWeekIndex = weeks.reduce((found, week, index) => (targetDate >= week.from ? index : found), 0);
  }
  if (selectedWeekIndex === null || selectedWeekIndex >= weeks.length) {
    const todayIndex = weeks.reduce((found, week, index) => (today >= week.from ? index : found), -1);
    selectedWeekIndex = todayIndex >= 0 ? todayIndex : 0;
  }
  const week = weeks[selectedWeekIndex];
  const isLastWeek = selectedWeekIndex === weeks.length - 1;
  renderWeekTabs(weeks, selectedWeekIndex);

  const dayFormatter = new Intl.DateTimeFormat('es-CO', { weekday: 'long' });
  const fullDate = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  rq('#selected-week-label').textContent = `Semana ${selectedWeekIndex + 1} de ${weeks.length} · ${dayFormatter.format(week.days[0].date)} ${fullDate.format(week.days[0].date)} – ${dayFormatter.format(week.days.at(-1).date)} ${fullDate.format(week.days.at(-1).date)}${isLastWeek ? ` · incluye el total de ${MONTH_NAMES[month - 1]}` : ''}`;

  const body = rq('#weekly-audit-body');
  body.replaceChildren();
  let hasDemo = false;
  week.days.forEach(({ date, iso }) => {
    const record = dayRecord(route, iso, live);
    hasDemo ||= Boolean(record.demo);
    const future = iso > today;
    const row = document.createElement('tr');
    row.classList.toggle('is-today', iso === today);
    row.classList.toggle('is-future', future);
    row.classList.toggle('is-target', iso === targetDate);
    const dateCell = document.createElement('th');
    dateCell.scope = 'row';
    dateCell.innerHTML = `<span>${dayFormatter.format(date)}</span><small>${fullDate.format(date)}${record.live ? ' · en curso' : ''}</small>`;
    if (!future && record.cashAdjustment) {
      // Día del sistema anterior: el ajuste explica por qué la caja no es solo cobro − préstamos − gastos − salida.
      const note = document.createElement('small');
      note.className = 'cash-adjustment-note';
      note.textContent = `Ajuste de caja ${record.cashAdjustment > 0 ? '+' : '−'}${formatMoney(Math.abs(record.cashAdjustment))}`;
      note.title = record.adjustmentNote || 'Ajuste de caja del sistema anterior';
      dateCell.append(note);
    }
    row.append(dateCell);
    COLUMNS.forEach(({ key, editable }) => {
      if (!editable) { row.append(future ? moneyCell(null) : moneyCell(record[key])); return; }
      const cell = editableCell(iso, key, record[key], future);
      if (key === 'otherExpenses') { cell.classList.add('has-note-button'); cell.append(otherExpensesNoteButton(route, iso, future)); }
      if (key === 'cashOut') { cell.classList.add('has-note-button'); cell.append(cashOutNoteButton(route, iso, future)); }
      row.append(cell);
    });
    row.append(moneyCell(future ? null : ledgerDifference(record), { negativeClass: true }));
    row.append(moneyCell(future ? null : cashBoxAt(route, iso, live)));
    body.append(row);
  });

  const foot = rq('#weekly-audit-foot');
  foot.replaceChildren();
  const weekTotals = sumDays(route, week.days.filter(day => day.iso <= today), live);
  foot.append(totalsRow(`Total semana ${selectedWeekIndex + 1}`, weekTotals, 'week-total-row'));
  if (isLastWeek) {
    const monthDays = weeks.flatMap(item => item.days).filter(day => day.iso <= today);
    const monthTotals = sumDays(route, monthDays, live);
    foot.append(totalsRow(`Total ${MONTH_NAMES[month - 1]} ${year}`, monthTotals, 'month-total-row'));
  }

  rq('#weekly-collections').textContent = formatMoney(weekTotals.collections);
  const difference = rq('#weekly-difference');
  difference.textContent = formatMoney(weekTotals.difference);
  difference.classList.toggle('is-short', weekTotals.difference < 0);
  difference.classList.toggle('is-surplus', weekTotals.difference > 0);
  // Sueldo del trabajador: lo escribe el admin y se suma a «otros gastos» con el comentario «Sueldo».
  const salaryInput = rq('#weekly-salary');
  const salary = route.weeklySalaries?.[week.from];
  const payDay = salary?.date || salaryDate(week, today);
  salaryInput.value = salary ? String(salary.amount) : '';
  salaryInput.dataset.week = week.from;
  salaryInput.dataset.date = payDay || '';
  salaryInput.disabled = !payDay || state.userRole !== 'admin';
  rq('#weekly-salary-hint').textContent = `${salary ? `Sumado a otros gastos del ${new Date(`${salary.date}T12:00:00`).toLocaleDateString('es-CO')} · ` : payDay ? '' : 'La semana aún no empieza · '}6 % del cobro: ${formatMoney(Math.round(weekTotals.collections * 0.06))}`;
  rq('#weekly-note').textContent = `Gastos, otros gastos y salida de caja se corrigen directamente en la tabla; con 💬 ves y corriges en qué fueron los otros gastos. El descuadre de la semana se reinicia cada sábado. Cada fecha queda guardada en el libro diario del cobro.${hasDemo ? ' Los días anteriores al primer cierre real son datos de demostración.' : ''}`;
  targetDate = null;
}

// ── Cierre mensual: seguros ──

function renderMonthlyInsurance(route, monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const routeId = reportRouteId();
  const isCurrentMonth = monthValue === localDateISO().slice(0, 7);
  const period = insurancePeriod(route, monthValue, liveInsurance(routeId, route).entries);
  rq('#monthly-period-label').textContent = MONTH_NAMES[month - 1].toLocaleUpperCase('es');
  rq('#monthly-period-year').textContent = String(year);
  // Resumen = lo que falta por cuadrar. Tras el cuadre queda en 0; la tabla conserva el detalle.
  const pendingTotal = period.lastCut ? 0 : period.total;
  rq('#monthly-insurance').textContent = formatMoney(pendingTotal);
  rq('#worker-insurance').textContent = formatMoney(Math.floor(pendingTotal / 2));
  rq('#owner-insurance').textContent = formatMoney(pendingTotal - Math.floor(pendingTotal / 2));
  rq('#insurance-summary-label').textContent = period.lastCut ? `Por cuadrar · ya se cuadraron ${formatMoney(period.cuts.reduce((sum, cut) => sum + cut.amount, 0))}` : 'Seguros por cuadrar';

  const weeks = calendarWeeks(monthValue);
  const body = rq('#monthly-insurance-body');
  body.replaceChildren();
  const addRow = (label, amount, className = '') => {
    const row = document.createElement('tr');
    if (className) row.className = className;
    const head = document.createElement('th');
    head.scope = 'row';
    head.textContent = label;
    row.append(head);
    [amount, Math.floor(amount / 2), amount - Math.floor(amount / 2)].forEach(value => row.append(moneyCell(value)));
    body.append(row);
    return row;
  };
  const cutLabel = cut => new Date(cut.ts).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit' });
  weeks.forEach((week, index) => {
    // Lo que viene del mes anterior (cobrado después de su cuadre) se suma a la primera semana.
    const inWeek = entry => (entry.date >= week.from && entry.date <= week.to) || (index === 0 && entry.date < week.from);
    const amount = period.entries.filter(inWeek).reduce((sum, entry) => sum + entry.amount, 0);
    const row = addRow(`Semana ${index + 1} · ${shortDate(week.days[0].date)} – ${shortDate(week.days.at(-1).date)}`, amount);
    // La semana en que se cuadró se marca en verde, con la fecha del cuadre en la misma fila.
    const cutsHere = period.cuts.filter(cut => weeks.reduce((found, item, i) => (localDateISO(new Date(cut.ts)) >= item.from ? i : found), 0) === index);
    if (cutsHere.length) {
      row.classList.add('is-cut-week');
      const badge = document.createElement('span');
      badge.className = 'cut-badge';
      badge.textContent = `✂ Cuadrado ${cutsHere.map(cutLabel).join(' · ')}`;
      badge.title = cutsHere.map(cut => `Cuadre del ${cutLabel(cut)}: ${formatMoney(cut.amount)}`).join('\n');
      row.querySelector('th').append(badge);
    }
  });
  const foot = rq('#monthly-insurance-foot');
  foot.replaceChildren();
  const totalRow = document.createElement('tr');
  const label = document.createElement('th');
  label.scope = 'row';
  label.textContent = 'Total del periodo';
  totalRow.append(label);
  [period.total, Math.floor(period.total / 2), period.total - Math.floor(period.total / 2)].forEach(value => totalRow.append(moneyCell(value)));
  foot.append(totalRow);

  const status = rq('#insurance-cut-status');
  const detail = rq('#insurance-cut-detail');
  const button = rq('#insurance-cut-button');
  const cutDate = cut => new Date(cut.ts).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (period.lastCut) {
    const lastDay = new Date(year, month, 0).getDate();
    const early = new Date(period.lastCut.ts).getDate() < lastDay;
    status.textContent = `✂ Cuadrado el ${cutDate(period.lastCut)}${early ? ' · antes de fin de mes' : ''}`;
    const cutList = period.cuts.map(cut => `${new Date(cut.ts).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit' })}: ${formatMoney(cut.amount)}`).join(' · ');
    detail.textContent = `${period.cuts.length > 1 ? `Cuadres del mes: ${cutList}. ` : `Cuadre: ${formatMoney(period.lastCut.amount)}.`}`;
  } else {
    status.textContent = 'Pendiente por cuadrar';
    detail.textContent = '';
  }
  const undo = rq('#insurance-undo-button');
  rq('#insurance-test-badge').hidden = !INSURANCE_CUT_TEST_MODE;
  if (INSURANCE_CUT_TEST_MODE) {
    // Modo de prueba: cualquier mes, varias veces, con fecha elegida y opción de deshacer.
    button.hidden = false;
    button.disabled = false;
    button.textContent = 'Cuadrar seguros (prueba)';
    undo.hidden = !period.cuts.length;
    return;
  }
  undo.hidden = true;
  // Solo el mes en curso se cuadra; el monto es lo acumulado desde el último cuadre.
  const pending = isCurrentMonth ? pendingInsurance(route, routeId, monthValue) : 0;
  button.hidden = !isCurrentMonth;
  button.disabled = pending <= 0;
  button.textContent = pending > 0 ? `Cuadrar seguros · ${formatMoney(pending)}` : 'Cuadrar seguros';
}

/** Seguros acumulados desde el último cuadre (o desde que empezó el periodo del mes). */
function pendingInsurance(route, routeId, monthValue) {
  const live = liveInsurance(routeId, route).entries;
  const period = insurancePeriod(route, monthValue, live);
  const since = Math.max(period.from, period.lastCut ? period.lastCut.ts : -Infinity);
  return insuranceEntries(route, live).filter(entry => entry.ts > since).reduce((sum, entry) => sum + entry.amount, 0);
}

/** Modo de prueba: cuadre con fecha y hora elegidas dentro del mes mostrado. */
function cutInsuranceTest(route) {
  const routeId = reportRouteId();
  const monthValue = selectedMonth();
  const isCurrentMonth = monthValue === localDateISO().slice(0, 7);
  const [year, month] = monthValue.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const pad = value => String(value).padStart(2, '0');
  const now = new Date();
  const defaultValue = isCurrentMonth
    ? `${localDateISO(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    : `${monthValue}-${pad(lastDay)}T20:00`;
  openCustomModal({
    title: 'Cuadrar seguros · modo de prueba',
    description: `Elige la fecha y hora del cuadre dentro de ${MONTH_NAMES[month - 1]} ${year}. Se cuadra lo cobrado desde el cuadre anterior (o desde que empezó el periodo) hasta ese momento; lo cobrado después pasa al mes siguiente.`,
    fields: [{ name: 'when', label: 'Fecha y hora del cuadre', type: 'datetime-local', value: defaultValue, required: true }],
    submitLabel: 'Cuadrar',
    onSubmit: values => {
      const ts = new Date(values.when).getTime();
      if (!Number.isFinite(ts) || values.when.slice(0, 7) !== monthValue) { rq('#custom-modal-error').textContent = `La fecha debe estar dentro de ${MONTH_NAMES[month - 1]} ${year}.`; return false; }
      if (ts > Date.now()) { rq('#custom-modal-error').textContent = 'La fecha no puede ser futura.'; return false; }
      const amount = insuranceDueAt(route, ts, liveInsurance(routeId, route).entries);
      cutInsurance(route, amount, 'Administrador (prueba)', ts);
      persistBusinessData();
      renderRouteReports(route);
      showToast(`Cuadre de prueba registrado el ${new Date(ts).toLocaleString('es-CO')}: ${formatMoney(amount)}.`);
    },
  });
}

function undoInsuranceCut(route) {
  const removed = undoLastInsuranceCut(route, selectedMonth());
  if (!removed) return;
  persistBusinessData();
  renderRouteReports(route);
  showToast(`Se deshizo el cuadre del ${new Date(removed.ts).toLocaleString('es-CO')} (${formatMoney(removed.amount)}).`);
}

function cutInsuranceNow(route) {
  if (INSURANCE_CUT_TEST_MODE) { cutInsuranceTest(route); return; }
  const routeId = reportRouteId();
  const monthValue = localDateISO().slice(0, 7);
  const amount = pendingInsurance(route, routeId, monthValue);
  if (amount <= 0) return;
  const lastDay = new Date(Number(monthValue.slice(0, 4)), Number(monthValue.slice(5)), 0).getDate();
  const early = new Date().getDate() < lastDay;
  openCustomModal({
    title: 'Cuadrar seguros',
    description: `Se cuadran ${formatMoney(amount)} de seguros del cobro ${route.name}: ${formatMoney(Math.floor(amount / 2))} para el trabajador y ${formatMoney(amount - Math.floor(amount / 2))} para el dueño. El acumulado vuelve a 0.${early ? ' Como aún no termina el mes, los seguros que se cobren desde ahora pasarán al mes siguiente.' : ''}`,
    submitLabel: 'Cuadrar seguros',
    onSubmit: () => {
      cutInsurance(route, amount);
      persistBusinessData();
      renderRouteReports(route);
      showToast(`Seguros cuadrados: ${formatMoney(amount)}.`);
    },
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_reportsModule() {
  rq('#cashbox-entry').addEventListener('click', () => openCashEntry(state.activeSettlement));
  DATE_PICKERS.forEach(selector => rq(selector).addEventListener('change', event => {
    const value = event.target.value;
    if (!value) return;
    reportDate = value;
    targetDate = value;
    selectedWeekIndex = null;
    if (new Date(`${value}T12:00:00`).getDay() === 0) showToast('Los domingos no se cobra: se muestra la semana que terminó el sábado.');
    renderRouteReports(state.activeSettlement);
  }));
  rq('#week-selector').addEventListener('click', event => {
    const tab = event.target.closest('.week-tab');
    if (!tab) return;
    selectedWeekIndex = Number(tab.dataset.week);
    renderRouteReports(state.activeSettlement);
  });
  // Corrección de gastos, otros gastos y salida de caja directamente en la tabla.
  rq('#weekly-audit-body').addEventListener('change', event => {
    const input = event.target.closest('.ledger-input');
    if (!input || state.userRole !== 'admin') return;
    const route = state.activeSettlement;
    setDayField(route, input.dataset.date, input.dataset.field, input.value);
    persistBusinessData();
    // Se repinta en el siguiente ciclo: así no se quita la celda mientras aún tiene el foco.
    window.setTimeout(() => renderRouteReports(route), 0);
    const label = COLUMNS.find(column => column.key === input.dataset.field).label;
    showToast(`${label} del ${new Date(`${input.dataset.date}T12:00:00`).toLocaleDateString('es-CO')} actualizado: ${formatMoney(Number(input.value) || 0)}.`);
  });
  rq('#weekly-audit-body').addEventListener('click', event => {
    const button = event.target.closest('.expense-note-button');
    if (!button || state.userRole !== 'admin') return;
    if (button.dataset.noteField === 'cashOut') openCashOutNote(state.activeSettlement, button.dataset.noteDate);
    else openOtherExpensesNote(state.activeSettlement, button.dataset.noteDate);
  });
  rq('#weekly-salary').addEventListener('change', event => {
    const input = event.target;
    if (state.userRole !== 'admin' || !input.dataset.week || !input.dataset.date) return;
    const route = state.activeSettlement;
    const amount = Math.round(Number(input.value) || 0);
    const date = setWeekSalary(route, input.dataset.week, input.dataset.date, amount);
    persistBusinessData();
    window.setTimeout(() => renderRouteReports(route), 0);
    showToast(amount ? `Sueldo de ${formatMoney(amount)} sumado a otros gastos del ${new Date(`${date}T12:00:00`).toLocaleDateString('es-CO')}.` : 'Sueldo quitado de otros gastos.');
  });
  rq('#insurance-cut-button').addEventListener('click', () => cutInsuranceNow(state.activeSettlement));
  rq('#insurance-undo-button').addEventListener('click', () => undoInsuranceCut(state.activeSettlement));
  document.querySelectorAll('[data-report-tab]').forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.reportTab;
    document.querySelectorAll('[data-report-tab]').forEach(tab => {
      const active = tab === button;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-report-panel]').forEach(panel => { panel.hidden = panel.dataset.reportPanel !== selected; });
  }));
}

// ── js/features/admin/settlement.js
/**
 * features/admin/settlement · Liquidación (cuadre de caja) y cierre de ruta con descuadre.
 */












const CLOSURE_FIELDS = ['collections', 'base', 'loans', 'expenses', 'otherExpenses', 'cashDelivered'];

/** Estado del cierre de hoy: 'closed' (enviado y sin cambios), 'changed' (editado después) o null. */
function closureStatus(route) {
  const closure = route?.lastClosure;
  if (!closure || closure.date !== localDateISO()) return null;
  // Tras el cierre el día se reinicia: se compara contra los valores que quedaron después del reinicio.
  const reference = closure.after || closure.snapshot;
  return CLOSURE_FIELDS.every(field => Number(route[field] || 0) === Number(reference?.[field] || 0)) ? 'closed' : 'changed';
}

/** Marca con ✓ en el selector los cobros ya cuadrados y enviados hoy (⚠ si cambiaron después). */
function refreshRouteOptions() {
  [...routeSelect.options].forEach(option => {
    const route = routeSettlements[option.value];
    if (!route) return;
    const status = closureStatus(route);
    option.textContent = status === 'closed' ? `✓ ${route.name}` : status === 'changed' ? `⚠ ${route.name}` : route.name;
  });
  const route = routeSettlements[routeSelect.value];
  const status = closureStatus(route);
  const badge = document.querySelector('#route-closure-status');
  badge.hidden = !status;
  badge.dataset.status = status || '';
  if (status === 'closed') {
    const time = new Date(route.lastClosure.submittedAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    badge.textContent = `✓ Cuadrado y enviado hoy, ${time}`;
  } else if (status === 'changed') {
    badge.textContent = '⚠ Cambió después del cierre: verifica y envía de nuevo';
  }
}

/**
 * Reinicio del día al cerrar el cobro. Lo único que pasa al día siguiente es el efectivo:
 * se convierte en la base del nuevo día. Cobros, préstamos, gastos, otros gastos, seguros
 * y efectivo entregado vuelven a 0. El sábado el efectivo se entrega, así que la base
 * del lunes arranca en 0, salvo la «Base para el lunes» que el admin asigne ese sábado.
 */
function resetRouteDay(route, routeId, transfers = 0) {
  const computedCash = Number(route.collections || 0) + Number(route.base || 0) - Number(route.loans || 0) - Number(route.expenses || 0) - Number(route.otherExpenses || 0);
  const cash = Number(route.cashDelivered || 0) > 0 ? Number(route.cashDelivered) : Math.max(0, computedCash);
  const saturday = new Date().getDay() === 6;
  // Lo que entró por transferencia está en el banco: no pasa a la base del día siguiente.
  // El sábado solo pasa la base para el lunes que haya asignado el admin.
  const carried = saturday ? mondayBaseFor(route, localDateISO()) : Math.max(0, cash - transfers);
  route.collections = 0;
  route.loans = 0;
  route.expenses = 0;
  route.otherExpenses = 0;
  route.cashDelivered = 0;
  // La base del día siguiente (la misma que ve el trabajador) arranca con ese efectivo.
  route.base = carried;
  route.baseBank = 0;
  return { cash, carried, saturday };
}

/**
 * Al empezar un día nuevo, la base de cada ruta (y la caja de su trabajador) toma el efectivo
 * del último día cerrado. Solo una vez por día y solo si hoy todavía no hay movimientos, para
 * no pisar préstamos, cobros o una base que el admin ya haya asignado. Devuelve true si cambió algo.
 */
function applyCarriedBases(today = localDateISO()) {
  let changed = false;
  Object.entries(routeSettlements).forEach(([routeId, route]) => {
    if (!route || route.baseCarriedOn === today || route.lastClosure?.date === today) return;
    const started = ['collections', 'loans', 'expenses', 'otherExpenses', 'cashDelivered'].some(field => Number(route[field] || 0) !== 0);
    if (started) return;
    const carried = carriedBase(route, today, date => transfersOn(routeId, date));
    if (!carried) return;
    route.base = carried.amount;
    route.baseBank = 0;
    route.baseCarriedOn = today;
    route.baseCarriedFrom = carried.date;
    changed = true;
  });
  return changed;
}

/** Abonos de la ruta recibidos por transferencia en una fecha. */
function transfersOn(routeId, dateISO) {
  return Object.values(clients).reduce((sum, client) => {
    if (client?.route !== routeId) return sum;
    return sum + (client.payments || []).filter(payment => payment.date === dateISO && payment.method === 'transfer').reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  }, 0);
}

/**
 * Abonos de la ruta pendientes de cierre: los de hoy y los de días anteriores en que no se
 * cerró la ruta (suman en el cobro hasta el cierre). Tras «Verificar y cerrar ruta» salen.
 */
function renderDayPayments(routeId) {
  const today = localDateISO();
  const rows = pendingRoutePayments(clients, routeId, routeSettlements[routeId]);
  const total = rows.reduce((sum, row) => sum + Number(row.payment.amount), 0);
  const earlier = rows.filter(row => row.payment.date < today).length;
  const body = document.querySelector('#day-payments-body');
  body.replaceChildren(...rows.map(({ clientId, client, payment }) => {
    const row = document.createElement('tr');
    row.classList.toggle('is-earlier-day', payment.date < today);
    const name = document.createElement('th');
    name.scope = 'row';
    const card = cardLabel(clients, clientId);
    name.textContent = card ? `${client.name} · ${card}` : client.name;
    const date = document.createElement('td');
    date.className = 'day-payment-date';
    date.textContent = paymentStamp(payment);
    const method = document.createElement('td');
    method.textContent = payment.method === 'transfer' ? 'Transferencia' : 'Efectivo';
    const amount = document.createElement('td');
    amount.className = 'numeric';
    amount.textContent = formatMoney(payment.amount);
    row.append(name, date, method, amount);
    return row;
  }));
  const foot = document.querySelector('#day-payments-foot');
  foot.replaceChildren();
  if (rows.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<th scope="row" colspan="3">Total abonos</th><td class="numeric"></td>';
    row.lastElementChild.textContent = formatMoney(total);
    foot.append(row);
  }
  document.querySelector('#day-payments-wrap').hidden = !rows.length;
  document.querySelector('#day-payments-empty').hidden = Boolean(rows.length);
  document.querySelector('#day-payments-summary').textContent = rows.length
    ? `${rows.length} abono${rows.length === 1 ? '' : 's'} · ${formatMoney(total)}${earlier ? ` · ${earlier} de días sin cerrar` : ''}`
    : 'Sin abonos hoy';
}

const isSaturday = () => new Date().getDay() === 6;

/** Menú «Base para el lunes»: se ve siempre, pero solo se puede cambiar los sábados. */
function renderMondayBase(routeId) {
  const route = routeSettlements[routeId];
  const panel = document.querySelector('#monday-base');
  if (!route || !panel) return;
  const editable = isSaturday();
  const input = document.querySelector('#monday-base-amount');
  // Fuera del sábado se muestra la que quedó asignada el último sábado (si ya no se usó).
  const pending = route.mondayBase?.date && (editable ? route.mondayBase.date === localDateISO() : route.mondayBase.date >= lastSaturdayISO());
  const amount = pending ? Number(route.mondayBase.amount) || 0 : 0;
  if (document.activeElement !== input) input.value = pending ? String(amount) : '';
  input.disabled = !editable;
  document.querySelector('#monday-base-save').disabled = !editable;
  document.querySelector('#monday-base-summary').textContent = pending && amount ? formatMoney(amount) : editable ? 'Sin asignar' : 'Solo los sábados';
}

function lastSaturdayISO() {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 1) % 7));
  return localDateISO(date);
}

/** Guarda la base del lunes. Si el sábado ya se cerró, la base que dejó el cierre se ajusta ya. */
function saveMondayBase() {
  const routeId = routeSelect.value;
  const route = routeSettlements[routeId];
  if (!route || !isSaturday()) { showToast('La base para el lunes solo se puede asignar los sábados.'); return; }
  const today = localDateISO();
  const amount = Math.max(0, Math.round(Number(document.querySelector('#monday-base-amount').value) || 0));
  route.mondayBase = { amount, date: today, setAt: new Date().toISOString() };
  const closedToday = route.lastClosure?.date === today && route.ledger?.[today]?.closed;
  if (closedToday) {
    route.base = amount;
    route.baseBank = 0;
    route.lastClosure.carriedBase = amount;
    if (route.lastClosure.after) route.lastClosure.after.base = amount;
  }
  persistBusinessData();
  renderAdminRoute(routeId);
  refreshRouteOptions();
  showToast(amount ? `Base para el lunes de ${route.name}: ${formatMoney(amount)}.` : `${route.name} arranca el lunes en ${formatMoney(0)}.`);
}

/**
 * Junto al título «Base»: los seguros del día que ya están sumados en la base y la base sin
 * ellos. Tras cerrar hoy solo cuentan los seguros cobrados después del cierre.
 */
function renderBaseBreakdown(routeId) {
  const route = routeSettlements[routeId];
  if (!route) return;
  const today = localDateISO();
  const since = route.lastClosure?.date === today ? Date.parse(route.lastClosure.submittedAt) || 0 : 0;
  const insurance = insuranceCollectedOn(clients, routeId, today, since);
  document.querySelector('#base-insurance-label').textContent = insurance.count ? `Seguros del día (${insurance.count})` : 'Seguros del día';
  document.querySelector('#base-insurance').textContent = `+ ${formatMoney(insurance.total)}`;
  document.querySelector('#base-own').textContent = formatMoney(Number(route.base || 0) - insurance.total);
  document.querySelector('#base-breakdown').title = insurance.total
    ? `La base de ${formatMoney(route.base)} incluye ${formatMoney(insurance.total)} de seguros cobrados hoy`
    : 'Hoy no se han cobrado seguros en esta ruta';
}

/** Comentario de «Otros gastos» del día: es el mismo que sale en Reportes financieros. */
function renderSettlementOtherNote(routeId) {
  const route = routeSettlements[routeId];
  if (!route) return;
  const note = otherExpensesNote(route, localDateISO());
  const preview = document.querySelector('#settlement-other-note-preview');
  preview.hidden = !note;
  preview.textContent = note.replace(/\n/g, ' · ');
  preview.title = note;
  document.querySelector('#settlement-other-note').textContent = note ? '💬 Editar' : '💬 Comentario';
}

function openSettlementOtherNote() {
  const routeId = routeSelect.value;
  const route = routeSettlements[routeId];
  if (!route) return;
  const today = localDateISO();
  openCustomModal({
    title: `Otros gastos · ${route.name}`,
    description: `Comentario de hoy (${formatMoney(route.otherExpenses || 0)} en otros gastos). Sale en Reportes financieros, en «Otros gastos» de este día.`,
    fields: [{ name: 'note', label: '¿En qué se gastó?', type: 'textarea', rows: 4, value: otherExpensesNote(route, today), placeholder: 'Ej. Pinchada $ 12.000, gasolina $ 20.000' }],
    submitLabel: 'Guardar comentario',
    onSubmit: values => {
      setOtherExpensesNote(route, today, values.note);
      persistBusinessData();
      renderSettlementOtherNote(routeId);
      showToast('Comentario guardado. Ya sale en Reportes financieros.');
    },
  });
}

function renderRouteOperations(route) {
  if (!route) return;
  document.querySelector('#report-route-name').textContent = route.name.toLocaleUpperCase('es');
}

function recalculateSettlement() {
  const route = state.activeSettlement;
  if (!route) return;
  state.settlementDifference = route.collections + route.base - route.loans - route.expenses - route.cashDelivered - route.otherExpenses;
  const difference = document.querySelector('#metric-difference');
  const differenceCard = document.querySelector('#difference-card');
  difference.textContent = formatMoney(state.settlementDifference);
  differenceCard.classList.toggle('is-balanced', state.settlementDifference === 0);
  differenceCard.classList.toggle('is-short', state.settlementDifference < 0);
  differenceCard.classList.toggle('is-surplus', state.settlementDifference > 0);
  document.querySelector('#difference-caption').textContent = state.settlementDifference === 0 ? 'Cuadre perfecto' : state.settlementDifference < 0 ? `Faltan ${formatMoney(Math.abs(state.settlementDifference))}` : `Sobran ${formatMoney(state.settlementDifference)}`;
  document.querySelector('#verify-close-route').disabled = false;
  adminFeedback.textContent = state.settlementDifference < 0 ? 'La ruta presenta un faltante; el envío requerirá confirmación para auditoría.' : ''; 
  refreshRouteOptions();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_settlementModule() {
  document.querySelector('#monday-base-save').addEventListener('click', saveMondayBase);
  document.querySelector('#settlement-other-note').addEventListener('click', openSettlementOtherNote);
  settlementInputs.forEach(input => input.addEventListener('input', () => {
    const field = input.dataset.settlementField;
    const amount = Number(input.value);
    if (!state.activeSettlement) return;
    state.activeSettlement[field] = Number.isFinite(amount) && amount >= 0 ? amount : 0;
    if (field === 'base') renderBaseBreakdown(routeSelect.value);
    recalculateSettlement();
    persistBusinessData();
  }));
  document.querySelector('#verify-close-route').addEventListener('click', () => {
    const submitRouteClosure = () => {
      const payload = {
        route: state.activeSettlement.name,
        collections: state.activeSettlement.collections,
        base: state.activeSettlement.base,
        loans: state.activeSettlement.loans,
        expenses: state.activeSettlement.expenses,
        otherExpenses: state.activeSettlement.otherExpenses,
        cashDelivered: state.activeSettlement.cashDelivered,
        difference: state.settlementDifference,
        submittedAt: new Date().toISOString()
      };
      // Punto de integración para el POST del backend cuando la API esté disponible.
      window.dispatchEvent(new CustomEvent('edgecredit:route-close', { detail: payload }));
      const route = routeSettlements[routeSelect.value] || state.activeSettlement;
      const routeId = routeSelect.value;
      // Transferencias que entran a este cierre: también las de días anteriores sin cerrar.
      const transfers = pendingRoutePayments(clients, routeId, route)
        .filter(({ payment }) => payment.method === 'transfer')
        .reduce((sum, { payment }) => sum + Number(payment.amount), 0);
      route.lastClosure = {
        date: localDateISO(), submittedAt: payload.submittedAt, difference: payload.difference,
        snapshot: Object.fromEntries(CLOSURE_FIELDS.map(field => [field, Number(route[field] || 0)]))
      };
      // Libro diario: el día queda guardado con su fecha antes de reiniciar el resumen.
      const previousClosureTs = route.lastClosure?.date === localDateISO() && route.ledger?.[localDateISO()]?.closed ? Number(route.ledger[localDateISO()].closedTs) : 0;
      const insurance = insuranceCollectedOn(clients, routeId, localDateISO(), previousClosureTs).total;
      recordClosure(route, localDateISO(), { ...route, insurance, transfers }, Date.parse(payload.submittedAt));
      const reset = resetRouteDay(route, routeId, transfers);
      route.lastClosure.carriedBase = reset.carried;
      route.lastClosure.after = Object.fromEntries(CLOSURE_FIELDS.map(field => [field, Number(route[field] || 0)]));
      persistBusinessData();
      renderAdminRoute(routeId);
      refreshRouteOptions();
      const nextBase = reset.saturday
        ? `Sábado: el efectivo (${formatMoney(reset.cash)}) se entrega y la base del lunes arranca en ${formatMoney(reset.carried)}.`
        : transfers
          ? `El efectivo del día (${formatMoney(reset.cash)}) menos ${formatMoney(transfers)} de transferencias pasa como base del día siguiente: ${formatMoney(reset.carried)}. El resto del resumen quedó en 0.`
          : `El efectivo del día (${formatMoney(reset.cash)}) pasa como base del día siguiente; el resto del resumen quedó en 0.`;
      adminFeedback.textContent = `Cierre de ${state.activeSettlement.name} enviado para auditoría. Diferencia: ${formatMoney(payload.difference)}. ${nextBase}`;
      showToast(payload.difference === 0 ? `Ruta cerrada. ${nextBase}` : `Cierre enviado con diferencia para auditoría. ${nextBase}`);
    };
    if (state.settlementDifference !== 0) {
      const amount = formatMoney(Math.abs(state.settlementDifference));
      const direction = state.settlementDifference < 0 ? 'faltante' : 'sobrante';
      openCustomModal({
        title: 'Enviar cierre con diferencia',
        description: `Existe un descuadre de ${amount} (${direction}). ¿Desea enviar el cierre con esta diferencia para auditoría posterior?`,
        submitLabel: 'Enviar a auditoría',
        onSubmit: submitRouteClosure
      });
      return;
    }
    submitRouteClosure();
  });
}

// ── js/features/auth/device-trust.js
/**
 * features/auth/device-trust · «Recordar este dispositivo».
 *
 * Guarda en este navegador qué cuentas ya pasaron la verificación en dos pasos y hasta
 * cuándo. Mientras esté vigente no se pide el código de verificación.
 * Si el admin restablece la verificación de un trabajador (trustVersion cambia), la
 * confianza de ese trabajador deja de valer en todos los dispositivos.
 */


const TRUST_KEY = 'edgecredit-trusted-device';

function readTrust() {
  try { return JSON.parse(localStorage.getItem(TRUST_KEY) || 'null') || { accounts: {} }; }
  catch { return { accounts: {} }; }
}

function writeTrust(data) {
  try { localStorage.setItem(TRUST_KEY, JSON.stringify(data)); } catch { /* almacenamiento opcional */ }
}

/** ¿La cuenta ya verificó su código en este dispositivo y sigue vigente? */
function isAccountTrusted(label, version = 0) {
  const entry = readTrust().accounts[label];
  return Boolean(entry && entry.expires > Date.now() && Number(entry.version || 0) === Number(version || 0));
}

/** ¿Este navegador está recordado para alguna cuenta? */
function isBrowserTrusted() {
  return Object.values(readTrust().accounts).some(entry => entry.expires > Date.now());
}

function trustAccount(label, version = 0) {
  const data = readTrust();
  data.accounts[label] = { expires: Date.now() + TRUSTED_DEVICE_DAYS * 86400000, version: Number(version || 0), since: new Date().toISOString() };
  writeTrust(data);
}

/** Olvida este dispositivo para todas las cuentas. */
function forgetDevice() {
  writeTrust({ accounts: {} });
}

/** Muestra en la pantalla de ingreso si este dispositivo está recordado. */
function refreshTrustedState() {
  const note = document.querySelector('#trusted-device-note');
  if (note) note.hidden = !isBrowserTrusted();
}

function __mount_deviceTrustModule() {
  document.querySelector('#forget-device').addEventListener('click', () => { forgetDevice(); refreshTrustedState(); });
  refreshTrustedState();
}

// ── js/features/auth/session.js
/**
 * features/auth · Inicio y cierre de sesión (trabajador / administrador).
 *
 * Flujo: usuario + contraseña → verificación en dos pasos (TOTP, salvo dispositivo recordado) → app.
 * Tras varios intentos fallidos el dispositivo se bloquea unos segundos.
 *
 * Con servidor, la sesión de Supabase queda guardada en el navegador: al recargar o abrir la
 * app se restaura sin pedir nada si es válida, ya pasó la verificación en dos pasos (aal2, o
 * un dispositivo recordado) y el perfil sigue activo (acceso y horario). Se cierra sola tras
 * `security.session.idleHours` horas sin usar la app, y «Cerrar sesión» la cierra de verdad.
 */





























// ── Bloqueo por intentos fallidos (por dispositivo) ──
const LOCK_KEY = 'edgecredit-login-guard';

function readGuard() {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null') || { failures: 0, lockedUntil: 0 }; }
  catch { return { failures: 0, lockedUntil: 0 }; }
}

function writeGuard(guard) {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(guard)); } catch { /* opcional */ }
}

function lockRemainingSeconds() {
  return Math.max(0, Math.ceil((readGuard().lockedUntil - Date.now()) / 1000));
}

/** Suma un intento fallido; al llegar al máximo bloquea el ingreso. */
function registerFailure() {
  const guard = readGuard();
  guard.failures += 1;
  if (guard.failures >= MAX_LOGIN_ATTEMPTS) {
    guard.failures = 0;
    guard.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
  }
  writeGuard(guard);
  return Math.max(0, MAX_LOGIN_ATTEMPTS - guard.failures);
}

function clearFailures() {
  writeGuard({ failures: 0, lockedUntil: 0 });
}

let lockTimer = null;
function showLockCountdown() {
  window.clearInterval(lockTimer);
  const submit = document.querySelector('#login-submit');
  const tick = () => {
    const seconds = lockRemainingSeconds();
    submit.disabled = seconds > 0;
    if (seconds > 0) loginError.textContent = `Demasiados intentos fallidos. Intenta de nuevo en ${seconds} s.`;
    else { window.clearInterval(lockTimer); if (loginError.textContent.startsWith('Demasiados')) loginError.textContent = ''; }
  };
  tick();
  lockTimer = window.setInterval(tick, 1000);
}

function failLogin(message) {
  const remaining = registerFailure();
  if (lockRemainingSeconds() > 0) { showLockCountdown(); return; }
  loginError.textContent = remaining <= 2 ? `${message} Te quedan ${remaining} intento(s).` : message;
}

/** Código 2FA incorrecto: cuenta como intento fallido y, si se bloquea, vuelve al primer paso. */
function failSecondFactor() {
  registerFailure();
  if (lockRemainingSeconds() > 0) cancelSecondFactor();
}

function logout() {
  if (backendEnabled()) endServerSession();
  forgetActivity();
  cancelSecondFactor();
  document.querySelector('#login-form').reset();
  document.querySelector('#login-user').value = '';
  document.querySelector('#login-password').value = '';
  paymentForm.reset();
  if (state.locationWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.locationWatchId);
  state.locationWatchId = null;
  gpsIndicator.classList.remove('is-active', 'is-searching', 'is-denied');
  gpsIndicator.querySelector('.gps-indicator-label').textContent = 'GPS';
  closePayment();
  if (!customModal.hidden) closeCustomModal();
  if (!newClientModal.hidden) closeNewClientModal();
  if (!interestModal.hidden) closeInterestModal();
  document.querySelector('#directory-search').value = '';
  document.querySelector('#home-search').value = '';
  Object.keys(clients).forEach(clientId => { if (clients[clientId]) renderClientRows(clientId); });
  persistBusinessData();
  renderPendingRequests();
  state.activeWorker = personnel[0] || { id: 'worker-unassigned', name: 'Trabajador', route: '', openingAmount: 0 };
  state.workerRoute = routeKey(state.activeWorker.route);
  state.userRole = 'worker';
  state.authenticatedWorker = null;
  state.currentView = 'inicio';
  state.previousView = 'inicio';
  state.activeClient = null;
  syncRouteSelect();
  state.activeSettlement = routeSettlements[routeSelect.value] || null;
  workerView.hidden = true;
  adminView.hidden = true;
  loginGateway.hidden = false;
  document.body.classList.add('login-active');
  document.body.classList.remove('admin-mode', 'admin-client-mode', 'admin-menu-open', 'modal-open');
  document.querySelector('[data-report-tab="weekly"]').click();
  showAdminPanel('settlement');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Vigilancia del horario y del acceso individual durante la sesión del trabajador ──
function syncAccessFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('edgecredit-business-data') || 'null');
    const match = saved?.personnel?.find(worker => worker.id === state.activeWorker?.id);
    if (match && state.activeWorker) state.activeWorker.accessEnabled = match.accessEnabled;
    if (saved?.security?.workerAccess) Object.assign(security.workerAccess, saved.security.workerAccess);
  } catch { /* datos opcionales */ }
}

let closingWarned = false;
function checkWorkerSchedule() {
  if (state.userRole !== 'worker' || workerView.hidden) { closingWarned = false; return; }
  if (state.activeWorker?.accessEnabled === false) {
    logout();
    loginError.textContent = 'Tu sesión se cerró: el administrador desactivó tu acceso.';
    return;
  }
  const schedule = security.workerAccess;
  if (!isWithinSchedule(schedule)) {
    logout();
    loginError.textContent = `Tu sesión se cerró porque terminó el horario de acceso (${describeSchedule(schedule)}).`;
    return;
  }
  const left = minutesUntilClose(schedule);
  if (left !== null && left <= 10 && !closingWarned) {
    closingWarned = true;
    showToast(`El horario de acceso termina en ${left} minuto${left === 1 ? '' : 's'}. Guarda lo que estés registrando.`);
  }
}

// ── Autenticación ──

/** Modo local (sin servidor): credenciales guardadas en este navegador. */
async function authenticateLocally() {
  const loginName = document.querySelector('#login-user').value.trim().toLocaleLowerCase('es');
  const isAdmin = loginName === 'admin';
  try {
    const submittedHash = await hashCredential(document.querySelector('#login-password').value);
    if (isAdmin) {
      if (submittedHash !== localAdminPasswordHash()) { failLogin('Usuario o contraseña de administrador incorrectos.'); return null; }
      return { isAdmin, account: { label: 'admin', record: security.admin, save: persistBusinessData, onFailure: failSecondFactor } };
    }
    const candidate = personnel.find(worker => worker.username?.toLocaleLowerCase('es') === loginName);
    if (!candidate || submittedHash !== candidate.passwordHash) { failLogin('Usuario o contraseña incorrectos.'); return null; }
    if (!workerMayEnter(candidate)) return null;
    return { isAdmin, account: { label: candidate.username, record: candidate, save: persistBusinessData, onFailure: failSecondFactor, worker: candidate } };
  } catch (error) {
    loginError.textContent = error.message || 'No se pudo validar la cuenta en este navegador.';
    return null;
  }
}

/** Acceso individual y horario: aun con credenciales válidas pueden impedir el ingreso. */
function workerMayEnter(worker) {
  if (worker.accessEnabled === false) {
    loginError.textContent = 'Tu acceso al sistema está desactivado. Comunícate con el administrador.';
    return false;
  }
  if (!isWithinSchedule(security.workerAccess)) {
    loginError.textContent = `Fuera del horario de acceso. Horario permitido: ${describeSchedule(security.workerAccess)}`;
    return false;
  }
  return true;
}

/** Modo servidor: Supabase Auth (contraseña) + MFA nativo de Supabase. */
async function authenticateWithServer() {
  const loginName = document.querySelector('#login-user').value.trim();
  let db;
  try { db = await backend(); }
  catch (error) { loginError.textContent = backendErrorMessage(error); return null; }
  const { data, error } = await db.auth.signInWithPassword({ email: usernameToEmail(loginName), password: document.querySelector('#login-password').value });
  if (error || !data?.user) {
    if (/fetch|network/i.test(String(error?.message))) loginError.textContent = backendErrorMessage(error);
    else failLogin('Usuario o contraseña incorrectos.');
    return null;
  }
  const user = data.user;
  const { data: profile, error: profileError } = await db.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (profileError || !profile) { loginError.textContent = 'No se encontró el perfil de esta cuenta. Comunícate con el administrador.'; await endServerSession(); return null; }
  if (profile.role === 'pending') { loginError.textContent = 'Tu cuenta todavía no tiene una ruta asignada. Pide al administrador que la active.'; await endServerSession(); return null; }
  const isAdmin = profile.role === 'admin';
  const { data: settings } = await db.from('app_settings').select('*').eq('key', 'worker_access').maybeSingle();
  if (settings?.data) Object.assign(security.workerAccess, settings.data);
  const worker = isAdmin ? null : serverWorker(profile);
  if (!isAdmin && !workerMayEnter(worker)) { await endServerSession(); return null; }
  // Verificación en dos pasos con el MFA de Supabase.
  const factors = await db.auth.mfa.listFactors();
  let factorId = factors.data?.totp?.find(factor => factor.status === 'verified')?.id || null;
  const remote = {
    needsEnroll: !factorId,
    async enroll() {
      const stale = (factors.data?.all || []).filter(factor => factor.status !== 'verified');
      for (const factor of stale) await db.auth.mfa.unenroll({ factorId: factor.id });
      const { data: enrolled, error: enrollError } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: `EdgeCredit ${new Date().toISOString()}`, issuer: 'EdgeCredit' });
      if (enrollError) throw enrollError;
      factorId = enrolled.id;
      return { secret: enrolled.totp.secret, uri: enrolled.totp.uri };
    },
    async verify(code) {
      const { error: verifyError } = await db.auth.mfa.challengeAndVerify({ factorId, code });
      return !verifyError;
    },
  };
  return { isAdmin, account: { label: profile.username, trustKey: user.id, record: {}, remote, worker, onFailure: failSecondFactor } };
}

/**
 * Cierra la sesión del servidor y limpia los datos de este dispositivo. Solo cierra la sesión
 * de este dispositivo (scope 'local'): el admin no pierde la sesión de sus otros equipos.
 */
async function endServerSession() {
  await stopSync();
  let signedOut = false;
  try { const db = await backend(); const { error } = await db.auth.signOut({ scope: 'local' }); signedOut = !error; } catch { /* sin conexión */ }
  // Sin conexión supabase-js conserva la sesión guardada: se borra a mano para que al
  // recargar no se vuelva a entrar sola.
  if (!signedOut) {
    try { Object.keys(localStorage).filter(key => key.startsWith('edgecredit-auth')).forEach(key => localStorage.removeItem(key)); } catch { /* opcional */ }
  }
  Object.keys(clients).forEach(key => delete clients[key]);
  pendingRequests.splice(0, pendingRequests.length);
}

// ── Cierre por inactividad ──
const ACTIVITY_KEY = 'edgecredit-last-activity';
const SESSION_SETTINGS_KEY = 'edgecredit-session-settings';

function idleLimitMs() {
  const hours = Number(security.session?.idleHours);
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 3600000;
}

function lastActivity() {
  try { return Number(localStorage.getItem(ACTIVITY_KEY)) || 0; } catch { return 0; }
}

/** Anota que la app se está usando (como mucho cada 30 s; lo comparten las pestañas). */
function markActivity(force = false) {
  if (!force && Date.now() - lastActivity() < 30000) return;
  try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch { /* opcional */ }
}

function forgetActivity() {
  try { localStorage.removeItem(ACTIVITY_KEY); } catch { /* opcional */ }
}

function idleExpired() {
  const last = lastActivity();
  return Boolean(last) && Date.now() - last > idleLimitMs();
}

const insideApp = () => loginGateway.hidden;

function idleMessage() {
  const hours = idleLimitMs() / 3600000;
  return `Tu sesión se cerró tras ${hours} hora${hours === 1 ? '' : 's'} sin usar la app. Vuelve a ingresar.`;
}

function checkIdle() {
  if (!insideApp() || !idleExpired()) return;
  logout();
  loginError.textContent = idleMessage();
}

// ── Restaurar la sesión guardada al abrir o recargar la app ──
let restoring = false;
let restoreRetryPending = false;

function setRestoring(on, message = '') {
  restoring = on;
  document.querySelector('#login-submit').disabled = on || lockRemainingSeconds() > 0;
  loginGateway.classList.toggle('is-restoring', on);
  loginError.textContent = message;
}

/** ¿La sesión guardada ya pasó la verificación en dos pasos? */
async function secondFactorDone(db, userId) {
  if (!TWO_FACTOR_REQUIRED) return true;
  const { data, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  if (data.currentLevel === 'aal2') return true;
  // Dispositivo recordado: al ingresar tampoco se pide el código, así que la sesión vale igual.
  return data.nextLevel === 'aal2' && isAccountTrusted(userId, 0);
}

/**
 * Al recargar no se ve la pantalla de ingreso: mientras se restaura la sesión guardada se
 * muestra «Cargando tu sesión…» (lo activa index.html antes de cargar la app) y al entrar
 * se vuelve a la pantalla en la que se estaba.
 */
async function restoreServerSession() {
  if (!backendEnabled() || restoring || insideApp()) { if (!backendEnabled()) document.documentElement.classList.remove('session-restoring'); return; }
  try {
    await restoreSavedSession();
  } finally {
    // Si no se pudo entrar, aparece el formulario de ingreso (con el motivo, si lo hay).
    if (!insideApp()) { restoring = false; loginGateway.classList.remove('is-restoring'); document.querySelector('#login-submit').disabled = lockRemainingSeconds() > 0; }
    document.documentElement.classList.remove('session-restoring');
  }
}

async function restoreSavedSession() {
  restoreRetryPending = false;
  try { Object.assign(security.session, JSON.parse(localStorage.getItem(SESSION_SETTINGS_KEY) || 'null') || {}); } catch { /* opcional */ }
  let db;
  try { db = await backend(); } catch { restoreRetryPending = true; return; }
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  const session = sessionData?.session;
  if (!session) {
    if (sessionError && /fetch|network/i.test(String(sessionError.message))) restoreRetryPending = true;
    return;
  }
  if (idleExpired()) {
    await endServerSession();
    forgetActivity();
    loginError.textContent = idleMessage();
    return;
  }
  setRestoring(true, 'Restaurando tu sesión…');
  try {
    const userId = session.user.id;
    if (!(await secondFactorDone(db, userId))) { await endServerSession(); setRestoring(false); return; }
    const { data: profile, error: profileError } = await db.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role === 'pending') { await endServerSession(); setRestoring(false); return; }
    const isAdmin = profile.role === 'admin';
    const { data: settings } = await db.from('app_settings').select('*').in('key', ['worker_access', 'session']);
    (settings || []).forEach(row => {
      if (row.key === 'worker_access' && row.data) Object.assign(security.workerAccess, row.data);
      if (row.key === 'session' && row.data) { Object.assign(security.session, row.data); try { localStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify(security.session)); } catch { /* opcional */ } }
    });
    const worker = isAdmin ? null : serverWorker(profile);
    if (!isAdmin && !workerMayEnter(worker)) { const message = loginError.textContent; await endServerSession(); setRestoring(false, message); return; }
    const account = { label: profile.username, trustKey: userId, record: {}, worker };
    if (!(await enterWithServer(account, isAdmin))) { setRestoring(false, loginError.textContent); return; }
    setRestoring(false);
    enterApp(account, isAdmin);
    restoreLastScreen(isAdmin);
  } catch (error) {
    // Sin conexión: la sesión se conserva y se reintenta al volver internet.
    const offline = /fetch|network/i.test(String(error?.message || error));
    if (offline) restoreRetryPending = true;
    else await endServerSession();
    setRestoring(false, offline ? 'Sin conexión: tu sesión se restaurará al volver internet.' : `No se pudo restaurar la sesión: ${backendErrorMessage(error)}`);
  }
}

function serverWorker(profile) {
  return { ...(profile.data || {}), id: profile.user_id, username: profile.username, email: profile.email, accessEnabled: profile.access_enabled !== false, route: profile.data?.route || profile.route_id || '' };
}

/** Carga los datos del servidor de una sesión ya verificada. false si no se pudo. */
async function enterWithServer(account, isAdmin) {
  loginError.textContent = 'Cargando datos del servidor…';
  try {
    if (!isAdmin) personnel.splice(0, personnel.length, account.worker);
    await startSync({ userId: account.trustKey, role: isAdmin ? 'admin' : 'worker', routeId: routeKey(account.worker?.route || ''), routeName: account.worker?.route });
    afterServerLoad();
  } catch (error) {
    loginError.textContent = `No se pudieron cargar los datos: ${backendErrorMessage(error)}`;
    await endServerSession();
    return false;
  }
  loginError.textContent = '';
  return true;
}

/** Tras cargar los datos del servidor: normaliza y repinta las listas. */
let afterServerLoad = () => {};
function setAfterServerLoad(fn) { afterServerLoad = fn; }

/** Muestra la vista del admin o del trabajador tras un ingreso exitoso. */
function enterApp(account, isAdmin) {
    clearFailures();
    markActivity(true);
    state.authenticatedWorker = account.worker || null;
    document.querySelector('#login-password').value = '';
    loginGateway.hidden = true;
    document.body.classList.remove('login-active');
    state.userRole = isAdmin ? 'admin' : 'worker';
    workerView.hidden = isAdmin;
    adminView.hidden = !isAdmin;
    document.body.classList.toggle('admin-mode', isAdmin);
    document.body.classList.remove('admin-client-mode');
    if (isAdmin) {
      document.querySelector('#add-client').hidden = true;
      document.querySelector('#admin-add-client').hidden = true;
      document.querySelector('#nav-daily-route').hidden = true;
      document.querySelector('#nav-map').hidden = true;
      gpsIndicator.hidden = true;
      syncRouteSelect();
      renderAdminRoute(routeSelect.value);
      showAdminPanel(defaultAdminPanel());
    } else {
    document.querySelector('#add-client').hidden = false;
    document.querySelector('#admin-add-client').hidden = false; // también el trabajador crea clientes desde el directorio
    document.querySelector('#nav-daily-route').hidden = false;
    document.querySelector('#nav-map').hidden = false;
      gpsIndicator.hidden = false;
      state.activeWorker = state.authenticatedWorker
        || personnel[0] || { id: 'worker-unassigned', name: 'Trabajador', route: '', openingAmount: 0 };
      state.workerRoute = routeKey(state.activeWorker.route);
      resumeWorkerLocationSharing();
      updateCashTotal();
      document.querySelector('#nav-daily-route').hidden = false;
      document.querySelector('#home-title').textContent = `Buen día, ${state.activeWorker.name.split(/\s+/)[0]}`;
      document.querySelector('.section-heading .avatar').textContent = state.activeWorker.name.trim().split(/\s+/).map(part => part[0]).slice(0, 1).join('').toUpperCase();
      document.querySelector('#home-title').closest('.section-heading').querySelector('.eyebrow').textContent = `RUTA ${state.activeWorker.route.toLocaleUpperCase('es')}`;
      renderWorkerDailyMetrics();
      showView('inicio');
      filterClientCards();
      renderRouteOperations(routeSettlements[state.workerRoute]);
      renderRouteBuilder();
      collapseHomePanels();
      showVehicleExpiryAlert(state.activeWorker);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_sessionModule() {
  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    loginError.textContent = '';
    if (lockRemainingSeconds() > 0) { showLockCountdown(); return; }
    const submit = document.querySelector('#login-submit');
    submit.disabled = true;
    try {
      const result = backendEnabled() ? await authenticateWithServer() : await authenticateLocally();
      if (!result) return;
      const { account, isAdmin } = result;
      // Segundo paso: código de la app de autenticación (o configuración en el primer ingreso).
      // En un dispositivo recordado (ya verificado y vigente) no se vuelve a pedir.
      const trusted = account.remote
        ? !account.remote.needsEnroll && isAccountTrusted(account.trustKey, 0)
        : Boolean(account.record.totpSecret) && isAccountTrusted(account.label, account.record.trustVersion);
      if (TWO_FACTOR_REQUIRED && !trusted) {
        const verified = await requestSecondFactor(account);
        if (!verified) {
          document.querySelector('#login-password').value = '';
          if (account.remote) await endServerSession();
          if (lockRemainingSeconds() > 0) showLockCountdown();
          document.querySelector('#login-password').focus();
          return;
        }
        if (document.querySelector('#two-factor-remember').checked) trustAccount(account.trustKey || account.label, account.remote ? 0 : account.record.trustVersion);
        refreshTrustedState();
      }
      // El horario o el acceso pudieron cambiar mientras se escribía el código.
      if (!isAdmin && account.worker?.accessEnabled === false) {
        loginError.textContent = 'Tu acceso al sistema está desactivado. Comunícate con el administrador.';
        if (account.remote) await endServerSession();
        return;
      }
      if (!isAdmin && !isWithinSchedule(security.workerAccess)) {
        loginError.textContent = `Fuera del horario de acceso. Horario permitido: ${describeSchedule(security.workerAccess)}`;
        if (account.remote) await endServerSession();
        return;
      }
      if (account.remote && !(await enterWithServer(account, isAdmin))) return;
      enterApp(account, isAdmin);
    } finally {
      submit.disabled = false;
    }
  });
  document.querySelectorAll('#worker-logout, #admin-logout').forEach(button => button.addEventListener('click', logout));
  // Modo servidor: si el admin cambia el acceso del trabajador, se aplica al instante.
  // Sin perfil (cambió el horario): solo se vuelve a revisar el horario.
  setAccessHook(profile => {
    if (state.userRole !== 'worker' || !state.activeWorker) return;
    if (profile) state.activeWorker.accessEnabled = profile.access_enabled !== false;
    checkWorkerSchedule();
  });
  // Sin servidor no hay usuarios iniciales que mostrar en otro dispositivo.
  if (backendEnabled()) document.querySelector('.login-demo-hint').hidden = true;
  if (lockRemainingSeconds() > 0) showLockCountdown();
  window.setInterval(checkWorkerSchedule, 30000);
  // Si el admin bloquea al trabajador desde otra pestaña del mismo navegador, se aplica al instante.
  window.addEventListener('storage', event => { if (event.key === 'edgecredit-business-data') { syncAccessFromStorage(); checkWorkerSchedule(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkIdle(); checkWorkerSchedule(); } });
  // Inactividad: cualquier toque, tecla o desplazamiento cuenta como uso.
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(type => document.addEventListener(type, () => { if (insideApp()) markActivity(); }, { passive: true, capture: true }));
  window.setInterval(checkIdle, 60000);
  window.addEventListener('online', () => { if (restoreRetryPending) restoreServerSession(); });
  restoreServerSession();
}

// ── js/features/auth/two-factor.js
/**
 * features/auth/two-factor · Segundo paso del inicio de sesión (TOTP).
 *
 * - Primer ingreso de una cuenta: genera la clave, muestra el QR para la app de
 *   autenticación, pide un código para confirmar y entrega 6 códigos de respaldo.
 * - Ingresos siguientes: pide el código de 6 dígitos (o un código de respaldo).
 *
 * `requestSecondFactor(account)` devuelve una promesa que se resuelve en true al
 * verificar y en false si la persona vuelve atrás.
 * account = { label, record, save }  · record guarda totpSecret, recoveryHashes,
 * totpLastStep y enrolledAt; save() persiste los cambios.
 */





const tf = selector => document.querySelector(selector);

let session = null; // { account, secret, enrolling, useRecovery, resolve }

function qrSvg(text) {
  const qr = createQRCode(text, 'M');
  const count = qr.getModuleCount();
  const margin = 4;
  const size = count + margin * 2;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

function setError(text) {
  tf('#two-factor-error').textContent = text;
}

function setRecoveryMode(on) {
  session.useRecovery = on;
  const input = tf('#two-factor-code');
  input.value = '';
  input.inputMode = on ? 'text' : 'numeric';
  input.placeholder = on ? 'XXXX-XXXX' : '000000';
  input.autocomplete = on ? 'off' : 'one-time-code';
  tf('#two-factor-code-label').textContent = on ? 'Código de respaldo' : 'Código de verificación';
  tf('#two-factor-recovery-toggle').textContent = on ? 'Usar el código de la app' : '¿Perdiste el celular? Usar un código de respaldo';
  setError('');
  input.focus();
}

function showStep(step) {
  tf('#login-form').hidden = step !== 'password';
  tf('#two-factor-form').hidden = step !== 'code';
  tf('#two-factor-recovery').hidden = step !== 'recovery';
}

/**
 * Con servidor (account.remote): la clave la genera y la verifica Supabase Auth (MFA
 * nativo); la app solo muestra el QR y envía el código. Sin servidor: TOTP local.
 */
async function requestSecondFactor(account) {
  let remoteEnrollment = null;
  if (account.remote?.needsEnroll) remoteEnrollment = await account.remote.enroll();
  return new Promise(resolve => {
    const enrolling = account.remote ? Boolean(account.remote.needsEnroll) : !account.record.totpSecret;
    const secret = remoteEnrollment?.secret || (enrolling ? generateTotpSecret() : account.record.totpSecret);
    session = { account, secret, enrolling, useRecovery: false, resolve, uri: remoteEnrollment?.uri };
    tf('#two-factor-title').textContent = enrolling ? 'Activa la verificación en dos pasos' : 'Ingresa tu código';
    tf('#two-factor-copy').textContent = enrolling
      ? `Protege la cuenta «${account.label}»: además de la contraseña se pedirá un código que cambia cada 30 segundos.`
      : `Abre tu app de autenticación y escribe el código de 6 dígitos de «${TWO_FACTOR_ISSUER} · ${account.label}».`;
    tf('#two-factor-enroll').hidden = !enrolling;
    tf('#two-factor-recovery-toggle').hidden = enrolling || Boolean(account.remote) || !(account.record.recoveryHashes || []).length;
    if (enrolling) {
      const uri = session.uri || otpauthUri(session.secret, account.label, TWO_FACTOR_ISSUER);
      tf('#two-factor-qr').innerHTML = qrSvg(uri);
      tf('#two-factor-secret').textContent = formatSecret(session.secret);
      tf('#two-factor-open-app').href = uri;
    }
    showStep('code');
    setRecoveryMode(false);
  });
}

function finish(ok) {
  const current = session;
  session = null;
  tf('#two-factor-code').value = '';
  tf('#two-factor-qr').replaceChildren();
  tf('#recovery-codes').replaceChildren();
  showStep('password');
  current?.resolve(ok);
}

/** Cierra el flujo sin verificar (cierre de sesión, recarga de la vista, etc.). */
function cancelSecondFactor() {
  if (session) finish(false);
}

async function submitCode(event) {
  event.preventDefault();
  if (!session) return;
  const { account, secret, enrolling } = session;
  const value = tf('#two-factor-code').value;
  const button = tf('#two-factor-submit');
  setError('');
  button.disabled = true;
  try {
    if (account.remote) {
      const digits = value.replace(/\D/g, '');
      if (digits.length !== 6) { setError('Escribe los 6 dígitos que muestra la app.'); return; }
      const ok = await account.remote.verify(digits);
      if (!ok) {
        setError('Código incorrecto o vencido. Revisa que la hora del celular sea automática.');
        if (!enrolling) account.onFailure?.();
        return;
      }
      finish(true);
      return;
    }
    if (session.useRecovery) {
      const code = normalizeRecoveryCode(value);
      if (!code) { setError('El código de respaldo tiene 8 caracteres (XXXX-XXXX).'); return; }
      const hash = await hashCredential(code);
      const hashes = account.record.recoveryHashes || [];
      if (!hashes.includes(hash)) { setError('Código de respaldo incorrecto o ya utilizado.'); account.onFailure?.(); return; }
      account.record.recoveryHashes = hashes.filter(item => item !== hash);
      account.save();
      finish(true);
      return;
    }
    const step = await verifyTotp(secret, value, { lastUsedStep: enrolling ? -1 : Number(account.record.totpLastStep ?? -1) });
    if (step === null) {
      const digits = value.replace(/\D/g, '');
      const lastStep = Number(account.record.totpLastStep ?? -1);
      const reused = !enrolling && digits.length === 6 && lastStep >= 0 && await totpForStep(secret, lastStep) === digits;
      setError(reused ? 'Ese código ya se usó. Espera a que la app muestre uno nuevo (cambia cada 30 segundos).'
        : digits.length === 6 ? 'Código incorrecto o vencido. Revisa que la hora del celular sea automática.' : 'Escribe los 6 dígitos que muestra la app.');
      if (!enrolling) account.onFailure?.();
      return;
    }
    account.record.totpLastStep = step;
    if (enrolling) {
      const codes = generateRecoveryCodes();
      account.record.totpSecret = secret;
      account.record.enrolledAt = new Date().toISOString();
      account.record.recoveryHashes = await Promise.all(codes.map(code => hashCredential(code)));
      account.save();
      showRecoveryCodes(codes);
      return;
    }
    account.save();
    finish(true);
  } catch (error) {
    setError(error.message || 'No se pudo verificar el código.');
  } finally {
    button.disabled = false;
  }
}

function showRecoveryCodes(codes) {
  const list = tf('#recovery-codes');
  list.replaceChildren(...codes.map(code => Object.assign(document.createElement('li'), { textContent: code })));
  tf('#recovery-copy').textContent = 'Copiar códigos';
  showStep('recovery');
  tf('#recovery-continue').focus();
}

async function copyText(text, button, done) {
  try { await navigator.clipboard.writeText(text); button.textContent = done; }
  catch { button.textContent = 'Cópialos a mano'; }
}

function __mount_twoFactorModule() {
  tf('#two-factor-form').addEventListener('submit', submitCode);
  tf('#two-factor-cancel').addEventListener('click', () => finish(false));
  tf('#two-factor-recovery-toggle').addEventListener('click', () => session && setRecoveryMode(!session.useRecovery));
  tf('#two-factor-code').addEventListener('input', event => {
    if (session?.useRecovery) return;
    const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== event.target.value) event.target.value = digits;
  });
  tf('#two-factor-copy-secret').addEventListener('click', event => session && copyText(session.secret, event.currentTarget, 'Copiada'));
  tf('#recovery-copy').addEventListener('click', event => copyText([...tf('#recovery-codes').children].map(item => item.textContent).join('\n'), event.currentTarget, 'Copiados'));
  tf('#recovery-continue').addEventListener('click', () => finish(true));
}

// ── js/features/clients/client-detail.js
/**
 * features/clients/client-detail · Ficha del cliente: saldo, progreso, historial
 * de abonos e intereses, y edición completa (solo admin).
 */





















/** Dentro de la ficha: la «cicatriz» del historial de pagos de la cartulina. */
function updatePaymentBehaviorUI(client) {
  const indicator = document.querySelector('#payment-behavior-indicator');
  rememberWorstHistory(client);
  const history = paymentHistory(client);
  indicator.style.setProperty('--behavior-color', history.color);
  indicator.classList.toggle('has-warning', history.level !== 'good');
  indicator.dataset.history = history.level;
  indicator.querySelector('span').textContent = history.label;
  indicator.title = history.level === 'good' ? history.detail : `${history.detail} La marca se conserva aunque la cartulina quede pagada.`;
}

function refreshClientBalance() {
  const total = clients[state.activeClient].balance;
  document.querySelector('#detail-balance').textContent = formatMoney(total);
  document.querySelector('#detail-balance-copy').textContent = formatMoney(total);
}

function createMethodIcon(method) {
  const transfer = method === 'transfer';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', transfer ? 'M4 8h15l-3-3m4 11H5l3 3' : 'M3 6.5h18v11H3z M6 10h.01 M18 14h.01 M10 12h4');
  svg.append(path);
  const icon = document.createElement('span');
  icon.className = `payment-method-indicator ${transfer ? 'is-transfer' : 'is-cash'}`;
  icon.title = transfer ? 'Transferencia' : 'Efectivo';
  icon.setAttribute('aria-label', transfer ? 'Transferencia' : 'Efectivo');
  const label = document.createElement('span');
  label.textContent = transfer ? 'Transf.' : 'Efectivo';
  icon.append(svg, label);
  return icon;
}

/** Fecha corta del historial, como en la tarjeta de la ruta diaria: «24-oct-26». */
function shortHistoryDate(iso) {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  if (!year) return '—';
  const name = new Date(year, month - 1, day).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
  return `${String(day).padStart(2, '0')}-${name}-${String(year).slice(-2)}`;
}

function renderHistory(client) {
  const paymentsList = document.querySelector('#payment-history-list');
  paymentsList.replaceChildren();
  client.payments ||= [];
  const isExpanded = expandedPaymentHistory.has(state.activeClient);
  const paymentsToRender = isExpanded ? client.payments : client.payments.slice(0, 3);
  const balances = balancesAfterPayments(client);
  paymentsToRender.forEach((payment, paymentIndex) => {
    const row = document.createElement('li');
    const dateAndMethod = document.createElement('span');
    dateAndMethod.className = 'history-date-method';
    const date = document.createElement('time');
    date.dateTime = payment.date;
    date.textContent = shortHistoryDate(payment.date);
    date.title = formatDate(payment.date);
    dateAndMethod.append(date, createMethodIcon(payment.method));
    if (payment.method === 'transfer' && !payment.receiptData) {
      const missing = document.createElement('small');
      missing.className = 'evidence-missing';
      missing.textContent = 'Falta evidencia';
      missing.setAttribute('role', 'status');
      dateAndMethod.append(missing);
    }
    if (payment.method === 'transfer' && payment.receiptData) {
      const evidenceLink = bindImageViewer(document.createElement('button'), { src: payment.receiptData, title: `Comprobante · ${formatMoney(payment.amount)}`, caption: `${client.name} · ${formatDate(payment.date)}` });
      evidenceLink.type = 'button';
      evidenceLink.className = 'evidence-link';
      evidenceLink.textContent = 'Ver foto';
      evidenceLink.setAttribute('aria-label', `Ver comprobante del ${formatDate(payment.date)}`);
      dateAndMethod.append(evidenceLink);
    }
    // Como el historial del sistema anterior: fecha, abono y el saldo que dejó, en columnas.
    row.className = 'history-payment-row';
    const amount = document.createElement('strong');
    amount.className = 'history-payment-amount';
    amount.textContent = formatMoney(payment.amount);
    const after = document.createElement('span');
    after.className = 'history-payment-balance';
    after.textContent = formatMoney(balances[paymentIndex]);
    row.append(dateAndMethod, amount, after);
    if (state.userRole === 'admin') {
      const actions = document.createElement('span');
      actions.className = 'history-admin-actions';
      ['Editar', 'Eliminar'].forEach((label, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.paymentAction = index === 0 ? 'edit' : 'delete';
        button.dataset.paymentIndex = String(paymentIndex);
        actions.append(button);
      });
      row.append(actions);
    }
    paymentsList.append(row);
  });
  if (paymentsToRender.length) {
    const head = document.createElement('li');
    head.className = 'history-payment-head';
    head.innerHTML = '<span>Fecha</span><span>Abono</span><span>Saldo</span>';
    paymentsList.prepend(head);
  }
  document.querySelector('#payment-history-count').textContent = client.archivedPaymentsAt && !client.payments.length ? 'Archivado' : isExpanded ? `${client.payments.length} registros` : `${Math.min(client.payments.length, 3)} recientes`;
  const historyToggle = document.querySelector('#payment-history-toggle');
  historyToggle.hidden = client.payments.length <= 3;
  historyToggle.textContent = isExpanded ? 'Mostrar solo los 3 más recientes' : 'Ver historial completo';
  if (!client.payments.length && client.archivedPaymentsAt) {
    const archived = document.createElement('li');
    archived.className = 'history-empty';
    archived.textContent = 'El historial de abonos se archivó después de una semana de cancelar esta cartulina.';
    paymentsList.append(archived);
  }

  const interestList = document.querySelector('#interest-history-list');
  interestList.replaceChildren();
  if (client.interestHistory.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Aún no hay intereses aplicados.';
    interestList.append(empty);
  } else {
    client.interestHistory.forEach(entry => {
      const row = document.createElement('li');
      const date = document.createElement('time');
      date.dateTime = entry.date;
      date.textContent = formatDate(entry.date);
      const amount = document.createElement('strong');
      amount.textContent = formatMoney(entry.amount);
      row.append(date, amount);
      interestList.append(row);
    });
  }
  document.querySelector('#interest-history-count').textContent = `${client.interestHistory.length} ${client.interestHistory.length === 1 ? 'recargo' : 'recargos'}`;
  renderRetanqueoHistory(client);
}

/** Reubica los abonos en sus cuotas cuando cambia la fecha de inicio de la cartulina. */
function reassignPaymentCycles(client) {
  (client.payments || []).forEach(payment => { if (!payment.beforeRestructure) payment.cycleIndex = paymentCycleIndex(client, payment.date); });
  client.paidPeriodIndexes = [...new Set((client.payments || []).filter(payment => !payment.beforeRestructure).map(payment => payment.cycleIndex))].sort((a, b) => a - b);
}

/** Texto del color que toma una cartulina con esa frecuencia y fecha de inicio. */
function startColorLabel(frequency, startDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ''))) return 'Elige una fecha';
  const color = cardColor({ balance: 1, frequency, creditStartDate: startDate });
  const weekday = new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(new Date(`${startDate}T12:00:00`));
  if (weekdayOf(startDate) === 0) return `Domingo: no se permite (elige sábado o lunes)`;
  if (!color) return `${weekday} · las diarias no llevan color`;
  return frequency === 'weekly' ? `${color.label} · cobra los ${weekday}` : `${color.label} · inicia un ${weekday}`;
}

/** Retanqueos de la cartulina (lo prestado de más, sus intereses y seguros, y cómo cambió el saldo). */
function renderRetanqueoHistory(client) {
  const retanqueos = (client.restructures || []).filter(entry => entry.type === 'retanqueo');
  const list = document.querySelector('#retanqueo-history-list');
  list.replaceChildren();
  if (!retanqueos.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Esta cartulina no tiene retanqueos.';
    list.append(empty);
  }
  retanqueos.forEach(entry => {
    const extra = Number(entry.extra) || 0;
    const interest = Number(entry.interest) || 0;
    const row = document.createElement('li');
    const copy = document.createElement('span');
    copy.className = 'retanqueo-history-copy';
    const date = document.createElement('time');
    date.dateTime = entry.date;
    date.textContent = formatDate(entry.date);
    const detail = document.createElement('small');
    const parts = [`Intereses ${formatMoney(interest)}`, `Seguros ${formatMoney(Number(entry.insurance) || 0)}`];
    if (entry.by) parts.push(entry.by);
    detail.textContent = parts.join(' · ');
    copy.append(date, detail);
    const amount = document.createElement('strong');
    amount.textContent = `+ ${formatMoney(extra)}`;
    const after = document.createElement('small');
    after.className = 'history-balance-after';
    const before = Number(entry.before?.balance);
    after.textContent = Number.isFinite(before) ? `Saldo ${formatMoney(before)} → ${formatMoney(before + extra + interest)}` : `Suma al saldo ${formatMoney(extra + interest)}`;
    amount.append(after);
    row.append(copy, amount);
    list.append(row);
  });
  document.querySelector('#retanqueo-history-count').textContent = `${retanqueos.length} ${retanqueos.length === 1 ? 'retanqueo' : 'retanqueos'}`;
}

function updateMoratoryButton(client) {
  const overdue = state.userRole !== 'admin' && creditDay(client) >= client.totalDays;
  interestToggle.hidden = !overdue;
  interestToggle.setAttribute('aria-hidden', String(!overdue));
}

const mapsSearchUrl = address => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Dirección alternativa, enlaces al mapa e historial de direcciones anteriores. */
function renderAddressDetails(client) {
  document.querySelector('#detail-alt-address').textContent = client.altAddress || '—';
  document.querySelector('#detail-address-notes').textContent = client.addressNotes || '—';
  const altLink = document.querySelector('#client-alt-location-link');
  altLink.hidden = !client.altAddress;
  if (client.altAddress) {
    altLink.href = mapsSearchUrl(client.altAddress);
    altLink.setAttribute('aria-label', `Abrir en el mapa la dirección alternativa de ${client.name}: ${client.altAddress}`);
  }
  const history = Array.isArray(client.addressHistory) ? client.addressHistory : [];
  document.querySelector('#address-history-count').textContent = history.length ? `${history.length} ${history.length === 1 ? 'cambio' : 'cambios'}` : 'Sin cambios';
  const list = document.querySelector('#address-history-list');
  list.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Esta dirección no ha sido modificada.';
    list.append(empty);
    return;
  }
  [...history].reverse().forEach(entry => {
    const row = document.createElement('li');
    const copy = document.createElement('span');
    copy.className = 'address-history-copy';
    const kind = document.createElement('small');
    kind.textContent = entry.type === 'alternativa' ? 'Dirección alternativa' : 'Dirección principal';
    const address = document.createElement('strong');
    address.textContent = entry.address || '(sin dirección)';
    const meta = document.createElement('small');
    meta.textContent = `Reemplazada el ${new Date(entry.changedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} por ${entry.changedBy || 'Administrador'}${entry.replacedBy ? ` · nueva: ${entry.replacedBy}` : ''}`;
    copy.append(kind, address, meta);
    row.append(copy);
    list.append(row);
  });
}

/** Notas compartidas (trabajador y admin pueden editarlas). */
function renderClientNotes(client) {
  const input = document.querySelector('#client-notes-input');
  input.value = client.notes || '';
  input.dataset.saved = input.value;
  document.querySelector('#save-client-notes').disabled = true;
  document.querySelector('#client-notes-status').textContent = '';
  document.querySelector('#client-notes-meta').textContent = client.notesUpdatedAt
    ? `Última edición: ${client.notesUpdatedBy || '—'} · ${new Date(client.notesUpdatedAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}`
    : 'Visibles para el trabajador y el administrador';
}

function saveClientNotes() {
  const client = clients[state.activeClient];
  const input = document.querySelector('#client-notes-input');
  if (!client) return;
  client.notes = input.value.trim();
  client.notesUpdatedAt = new Date().toISOString();
  client.notesUpdatedBy = state.userRole === 'admin' ? 'Administrador' : state.activeWorker?.name || 'Trabajador';
  persistBusinessData();
  renderClientNotes(client);
  document.querySelector('#client-notes-status').textContent = '✓ Nota guardada';
}

function renderLocationLink(client) {
  const customerLocation = document.querySelector('#client-location-link');
  customerLocation.href = hasCoordinates(client.location)
    ? `https://www.google.com/maps/dir/?api=1&destination=${Number(client.location.latitude)},${Number(client.location.longitude)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`;
  customerLocation.setAttribute('aria-label', `Abrir en el mapa el domicilio de ${client.name}: ${client.address}`);
}

/**
 * Aviso de la ficha cuando la cartulina no tiene ubicación (se creó sin GPS) o la tiene
 * aproximada. El trabajador la toma desde aquí cuando está en el domicilio; el admin ve el
 * aviso pero no el botón (su GPS sería el de la oficina) y puede ubicarlo en el mapa.
 */
function renderLocationPending(client) {
  const box = document.querySelector('#client-location-pending');
  const located = hasCoordinates(client.location);
  const approximate = located && isApproximateLocation(client.location);
  box.hidden = (located && !approximate) || Number(client.balance) <= 0;
  if (box.hidden) return;
  const isWorker = state.userRole === 'worker';
  box.classList.toggle('is-approximate', approximate);
  document.querySelector('#client-location-pending-title').textContent = approximate ? `Ubicación aproximada (± ${client.location.accuracy} m)` : 'Sin ubicación GPS';
  const reason = client.locationFailure && LOCATION_FAILURE_LABELS[client.locationFailure];
  document.querySelector('#client-location-pending-text').textContent = !isWorker
    ? 'El trabajador puede tomarla desde esta ficha, o ubícalo tú en el Mapa de clientes.'
    : approximate ? 'Si estás en el domicilio, tómala de nuevo para que quede exacta en el mapa.'
    : `${reason ? `No se pudo tomar al crearla (${reason}). ` : ''}Tómala cuando estés en el domicilio del cliente.`;
  const button = document.querySelector('#client-capture-location');
  button.hidden = !isWorker;
  button.innerHTML = `<span aria-hidden="true">⌖</span> ${approximate ? 'Tomar de nuevo' : 'Tomar ubicación ahora'}`;
}

async function captureClientLocation() {
  const clientId = state.activeClient;
  const button = document.querySelector('#client-capture-location');
  if (!clients[clientId] || button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Tomando ubicación…';
  const { location, reason } = await locateDevice({ timeout: 10000 });
  button.disabled = false;
  button.removeAttribute('aria-busy');
  const client = clients[clientId];
  if (!client) return;
  if (!location) {
    client.locationFailure = reason;
    persistBusinessData();
    if (state.activeClient === clientId) renderLocationPending(client);
    showToast(`No se pudo tomar la ubicación (${LOCATION_FAILURE_LABELS[reason] || 'sin GPS'}). Inténtalo de nuevo en el domicilio.`);
    return;
  }
  client.location = { ...location, source: 'ficha', by: state.activeWorker?.name || 'Trabajador' };
  delete client.locationPending;
  delete client.locationFailure;
  persistBusinessData();
  if (state.activeClient === clientId) { renderLocationLink(client); renderLocationPending(client); }
  showToast(isApproximateLocation(client.location)
    ? `Ubicación de ${client.name} guardada, pero es aproximada (± ${client.location.accuracy} m).`
    : `Ubicación de ${client.name} guardada (± ${client.location.accuracy} m).`);
}

function openClient(clientId) {
  const client = clients[clientId];
  if (!client) return;
  state.paymentFromHome = false;
  state.activeClient = clientId;
  document.querySelector('#detail-name').textContent = client.name;
    setClientAvatar(document.querySelector('#detail-avatar'), client);
  paintCardColorBand(document.querySelector('#detail-card-color'), client, document.querySelector('#detalle-cliente .detail-header'));
  // Estado actual: si hay períodos vencidos sin pagar se muestran como «Pagos atrasados N».
  const status = document.querySelector('#detail-status');
  const current = paymentBehavior(client);
  const late = current.overduePeriods > 0 || client.late;
  status.textContent = current.overduePeriods > 0 ? current.label : Number(client.balance) <= 0 ? 'Pagada' : client.status;
  status.classList.toggle('status-late', late);
  status.classList.toggle('status-current', !late);
  updateMoratoryButton(client);
  document.querySelector('#detail-balance').textContent = formatMoney(client.balance);
  document.querySelector('#detail-balance-copy').textContent = formatMoney(client.balance);
  const totalPaid = Math.max(0, Number(client.totalPaidAmount ?? (client.payments || []).reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) || 0), 0)));
  const outstanding = Math.max(0, Number(client.balance) || 0);
  const progressPercent = paidPercent(client);
  document.querySelector('#detail-paid-amount').textContent = formatMoney(totalPaid);
  document.querySelector('#detail-total-amount').textContent = formatMoney(totalPaid + outstanding);
  document.querySelector('.progress-ring').style.setProperty('--progress', `${progressPercent * 3.6}deg`);
  document.querySelector('.progress-center > strong').textContent = `${progressPercent}%`;
  document.querySelector('.progress-ring').setAttribute('aria-label', `${progressPercent} por ciento pagado`);
  const day = creditDay(client);
  document.querySelector('#route-day').textContent = `Día ${day} / ${client.totalDays} días`;
  const overdueDays = Math.max(0, day - client.totalDays);
  // Admin y trabajador ven lo mismo: los días que faltan o, ya vencida, los días de mora.
  const settled = Number(client.balance) <= 0;
  document.querySelector('#route-days-label').textContent = settled ? 'Cartulina pagada' : overdueDays > 0 ? 'Días de mora' : 'Días restantes para finalizar';
  document.querySelector('#route-days-left').textContent = settled ? `Pagada en ${day} ${day === 1 ? 'día' : 'días'}` : overdueDays > 0 ? `${overdueDays} ${overdueDays === 1 ? 'día' : 'días'}` : `Faltan ${Math.max(0, client.totalDays - day)} días`;
  document.querySelector('#route-days-left').classList.toggle('is-overdue', !settled && overdueDays > 0);
  document.querySelector('#detail-installment').textContent = formatMoney(client.installment);
  document.querySelector('#detail-id').textContent = client.id;
  document.querySelector('#detail-address').textContent = client.address;
  renderLocationLink(client);
  renderLocationPending(client);
  document.querySelector('#detail-phone').textContent = client.phone;
  document.querySelector('#detail-loan-total').textContent = formatMoney(client.total);
  document.querySelector('#detail-term').textContent = client.term;
  document.querySelector('#detail-frequency').textContent = paymentFrequencyLabels[client.frequency] || 'Semanal';
  document.querySelector('#detail-loan-count').textContent = loanCountLabel(loanCount(clients, client.id));
  document.querySelector('#detail-breakdown').textContent = client.breakdown;
  renderAddressDetails(client);
  renderClientNotes(client);
  document.querySelector('#detail-interest-rate').textContent = `${client.interestPercent ?? 20}%`;
  renderInsuranceDetails(client);
  renderRenewalDetails(client);
  updatePaymentBehaviorUI(client);
  document.querySelector('#payment-client-name').textContent = client.name;
  renderCardActions(client);
  renderPersonCards(state.activeClient);
  document.querySelector('[data-open-payment]').innerHTML = state.userRole === 'admin' ? 'Registrar abono <span aria-hidden="true">→</span>' : 'Registrar Pago <span aria-hidden="true">→</span>';
  document.querySelector('#admin-client-actions').hidden = state.userRole !== 'admin';
  refreshClientBalance();
  renderHistory(client);
  // Al abrir desde una lista se guarda su orden para moverse con Anterior / Siguiente.
  if (state.currentView !== 'detalle-cliente') state.cardSequence = visibleCardSequence(state.currentView);
  state.previousView = ['directorio', 'ruta-diaria', 'mapa'].includes(state.currentView) ? state.currentView : 'inicio';
  renderCardNav(clientId);
  closeDisclosure();
  showView('detalle-cliente');
}

/** Cartulinas que se ven en la lista de la pantalla actual, en su orden. */
function visibleCardSequence(view) {
  const selector = view === 'ruta-diaria' ? '#route-daily-list [data-route-client]'
    : view === 'inicio' ? '#inicio .client-row[data-client]:not([hidden])'
      : '#directorio .client-row[data-client]:not([hidden])';
  const ids = [...document.querySelectorAll(selector)].map(node => node.dataset.client || node.dataset.routeClient);
  return [...new Set(ids)].filter(id => clients[id]);
}

function renderCardNav(clientId) {
  const ids = state.cardSequence || [];
  const position = ids.indexOf(clientId);
  const nav = document.querySelector('#card-nav');
  nav.hidden = position < 0 || ids.length < 2;
  if (nav.hidden) return;
  document.querySelector('#card-nav-position').textContent = `${position + 1} de ${ids.length}`;
  document.querySelector('#card-prev').disabled = position === 0;
  document.querySelector('#card-next').disabled = position === ids.length - 1;
}

/** Abre la cartulina anterior o siguiente de la lista sin volver atrás. */
function moveToCard(step) {
  const ids = state.cardSequence || [];
  const next = ids[ids.indexOf(state.activeClient) + step];
  if (!next || !clients[next]) return;
  const back = state.previousView;
  openClient(next);
  state.previousView = back;
  window.scrollTo({ top: 0 });
}

function closeDisclosure() {
  disclosureButton.setAttribute('aria-expanded', 'false');
  creditDetails.classList.remove('is-expanded');
  creditDetails.style.maxHeight = '0px';
  window.setTimeout(() => {
    if (!creditDetails.classList.contains('is-expanded')) creditDetails.hidden = true;
  }, 240);
}

function toggleDisclosure() {
  const expanded = disclosureButton.getAttribute('aria-expanded') === 'true';
  if (expanded) return closeDisclosure();
  creditDetails.hidden = false;
  creditDetails.style.maxHeight = '0px';
  requestAnimationFrame(() => {
    creditDetails.classList.add('is-expanded');
    creditDetails.style.maxHeight = `${creditDetails.scrollHeight}px`;
  });
  disclosureButton.setAttribute('aria-expanded', 'true');
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function renderInsuranceDetails(client) {
  const insurance = clientInsurance(client);
  document.querySelector('#detail-insurance').textContent = insurance.custom
    ? `${formatMoney(insurance.amount)} · valor especial`
    : `${formatMoney(insurance.amount)} · general (10%)`;
  const reasonRow = document.querySelector('#detail-insurance-reason-row');
  reasonRow.hidden = !insurance.custom;
  document.querySelector('#detail-insurance-reason').textContent = insurance.reason || 'Sin comentario registrado';
}

function renewalDate(value) {
  return value ? formatDate(value) : 'fecha sin registrar';
}

function renderRenewalDetails(client) {
  const row = document.querySelector('#detail-renewal-row');
  const parts = [];
  if (client.renewedFrom) parts.push(`Renovación #${client.renewalCount || 1} · reemplaza la cartulina del ${renewalDate(clients[client.renewedFrom]?.creditStartDate)}`);
  const renewed = client.renewedTo && clients[client.renewedTo];
  if (renewed) parts.push(`Renovado el ${renewalDate(client.renewedAt)} con una cartulina nueva de ${formatMoney(clients[client.renewedTo].principal)}`);
  row.hidden = !parts.length;
  document.querySelector('#detail-renewal').textContent = parts.join(' · ');
}

/**
 * Acciones de la cartulina, arriba de la ficha:
 * - Registrar pago: solo mientras tenga saldo.
 * - Renovar: solo cuando está cancelada por completo y no se ha renovado antes.
 * - Otra cartulina: crédito simultáneo para la misma persona (hasta el máximo).
 */
function renderCardActions(client) {
  const cancelled = Number(client.balance) <= 0;
  const renewed = client.renewedTo && clients[client.renewedTo];
  const payButton = document.querySelector('[data-open-payment]');
  const renewButton = document.querySelector('#renew-client');
  const extraButton = document.querySelector('#extra-card-client');
  const hint = document.querySelector('#renew-hint');
  payButton.hidden = cancelled;
  // Renovar siempre está a la vista; mientras quede saldo aparece bloqueado y dice cuánto falta.
  renewButton.hidden = Boolean(renewed);
  const locked = !canRenew(state.activeClient);
  renewButton.classList.toggle('is-locked', locked);
  renewButton.setAttribute('aria-disabled', String(locked));
  const pending = document.querySelector('#renew-pending');
  pending.hidden = cancelled;
  pending.textContent = cancelled ? '' : `Falta pagar ${formatMoney(client.balance)}`;
  renewButton.title = locked ? 'Para renovar, primero hay que pagar todo el saldo de esta cartulina' : 'Crear una cartulina nueva con los mismos datos';
  const room = canAddCard(clients, client.id);
  extraButton.disabled = !room;
  extraButton.title = room ? 'Abrir otro crédito a nombre de esta persona' : `Máximo ${MAX_ACTIVE_CARDS_PER_PERSON} cartulinas activas por persona`;
  const notes = [];
  if (renewed) notes.push('Esta cartulina ya fue renovada.');
  if (!room) notes.push(`La persona ya tiene ${MAX_ACTIVE_CARDS_PER_PERSON} cartulinas activas (máximo).`);
  // Financiar y retanqueo mientras la cartulina tenga saldo. El admin lo aplica; el
  // trabajador llena lo mismo y le llega al admin como solicitud para aprobar o rechazar.
  const openRequest = pendingRestructure(pendingRequests, state.activeClient);
  const isWorker = state.userRole !== 'admin';
  // El trabajador solo puede solicitar financiar cuando ya pasaron los días del plazo.
  const daysLeft = Math.max(0, Number(client.totalDays || 0) - creditDay(client));
  const financeLocked = isWorker && !financeAllowed(client);
  [['#finance-client', 'finance', 'Financiar', 'Intereses por pasar el plazo'], ['#retanqueo-client', 'retanqueo', 'Retanqueo', 'Prestar más sobre esta cartulina']].forEach(([selector, type, label, sub]) => {
    const button = document.querySelector(selector);
    button.hidden = cancelled;
    const waiting = isWorker && openRequest?.type === type;
    const locked = type === 'finance' && financeLocked;
    button.disabled = (isWorker && Boolean(openRequest)) || locked;
    button.querySelector('.detail-action-label').lastChild.textContent = ` ${isWorker ? `Solicitar ${label.toLocaleLowerCase('es')}` : label}`;
    button.querySelector('.detail-action-sub').textContent = waiting ? 'Solicitud enviada: esperando al admin' : isWorker && openRequest ? 'Hay otra solicitud pendiente'
      : locked ? `Disponible cuando venza el plazo (falta${daysLeft === 1 ? '' : 'n'} ${daysLeft} día${daysLeft === 1 ? '' : 's'})` : sub;
  });
  hint.textContent = notes.join(' ');
  hint.hidden = !notes.length;
  document.querySelector('.detail-profile .eyebrow').textContent = cancelled ? 'CARTULINA CANCELADA' : 'CRÉDITO ACTIVO';
}

/**
 * Selector de cartulinas de la persona: solo las ACTIVAS (las canceladas no se muestran arriba).
 * Se ve con 2 o más activas, o si se abrió una cancelada y la persona tiene alguna activa.
 */
function renderPersonCards(clientId) {
  const client = clients[clientId];
  const ids = activeCardIds(clients, client.id);
  const nav = document.querySelector('#person-cards');
  const list = document.querySelector('#person-cards-list');
  const currentActive = ids.includes(clientId);
  const show = ids.length >= 2 || (!currentActive && ids.length >= 1);
  nav.hidden = !show;
  list.replaceChildren();
  if (!show) return;
  document.querySelector('#person-cards-label').textContent = `${ids.length} cartulina${ids.length === 1 ? '' : 's'} activa${ids.length === 1 ? '' : 's'}`;
  ids.forEach((id, index) => {
    const card = clients[id];
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'person-card-chip';
    chip.dataset.personCard = id;
    chip.classList.toggle('is-current', id === clientId);
    if (id === clientId) chip.setAttribute('aria-current', 'true');
    const name = document.createElement('strong');
    name.textContent = ids.length > 1 ? `Cartulina ${index + 1}` : 'Cartulina activa';
    const balance = document.createElement('small');
    balance.textContent = `Saldo ${formatMoney(card.balance)}`;
    chip.append(name, balance);
    list.append(chip);
  });
}

/** Repinta la ficha, el directorio y la liquidación después de cambiar la cartulina. */
function afterRestructure(clientId) {
  persistBusinessData();
  renderClientRows(clientId);
  filterClientCards();
  if (routeSelect.value === clients[clientId]?.route) renderAdminRoute(routeSelect.value);
  openClient(clientId);
}

/** Financiar es para cartulinas que ya pasaron los días del plazo acordado. */
const financeAllowed = client => creditDay(client) > Number(client.totalDays || 0);

/**
 * Solicitud del trabajador al admin con los parámetros que él mismo puso. El admin la aprueba
 * (se aplica tal cual) o la rechaza desde Solicitudes.
 */
function sendRestructureRequest(clientId, type, params) {
  const client = clients[clientId];
  pendingRequests.unshift({
    id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, routeId: routeKey(client.route), route: client.route,
    workerId: state.activeWorker?.id, workerName: state.activeWorker?.name || 'Trabajador', clientId, clientName: client.name,
    params, createdAt: new Date().toISOString(), status: 'pending',
  });
  persistBusinessData();
  renderCardActions(client);
  showToast(`Solicitud de ${type === 'finance' ? 'financiación' : 'retanqueo'} enviada al administrador.`);
}

/** Financiar: intereses por pasar los días acordados (20 % del saldo si no se escribe otro valor) y plazo nuevo. */
function openFinanceModal() {
  const clientId = state.activeClient;
  const client = clients[clientId];
  if (!client || Number(client.balance) <= 0) return;
  const isWorker = state.userRole !== 'admin';
  if (isWorker && pendingRestructure(pendingRequests, clientId)) { showToast('Esta cartulina ya tiene una solicitud pendiente con el administrador.'); return; }
  if (isWorker && !financeAllowed(client)) { showToast('Solo se puede solicitar financiar cuando ya pasaron los días del plazo.'); return; }
  openCustomModal({
    title: `${isWorker ? 'Solicitar financiar' : 'Financiar'} · ${client.name}`,
    description: `Saldo actual ${formatMoney(client.balance)}. Se le suman los intereses de financiación y arranca un plazo nuevo desde hoy.`,
    fields: [
      { type: 'note', label: 'Interés de financiación', value: `${FINANCE_INTEREST_PERCENT}%`, hint: `General: ${FINANCE_INTEREST_PERCENT} % del saldo = ${formatMoney(percentOrAmount(client.balance, FINANCE_INTEREST_PERCENT))}`, valueId: 'finance-rate-value', hintId: 'finance-rate-hint' },
      { type: 'checkbox', name: 'customInterest', label: 'Usar un interés diferente al general' },
      { name: 'percent', label: 'Interés de financiación (%) sobre el saldo', type: 'number', min: 0, max: 100, step: 0.1, value: FINANCE_INTEREST_PERCENT, required: true, showWhen: 'customInterest' },
      { name: 'totalDays', label: 'Plazo nuevo (días) desde hoy', type: 'number', min: 1, step: 1, value: client.totalDays || 30, required: true },
    ],
    onInput: form => {
      const percent = form.elements.customInterest.checked ? Number(form.elements.percent.value) || 0 : FINANCE_INTEREST_PERCENT;
      document.querySelector('#finance-rate-value').textContent = `${percent}%`;
      document.querySelector('#finance-rate-hint').textContent = `${percent} % del saldo = ${formatMoney(percentOrAmount(client.balance, percent))}`;
    },
    submitLabel: isWorker ? 'Enviar solicitud al admin' : 'Financiar',
    onSubmit: values => {
      const percent = values.customInterest ? Number(values.percent) : FINANCE_INTEREST_PERCENT;
      const interest = percentOrAmount(client.balance, percent);
      if (!(interest > 0)) { customModalError.textContent = 'Escribe un porcentaje mayor que cero.'; return false; }
      if (isWorker) {
        sendRestructureRequest(clientId, 'finance', { interest, totalDays: Math.round(Number(values.totalDays)), percent, balance: Number(client.balance) });
        return;
      }
      financeCard(client, { interest, totalDays: values.totalDays });
      afterRestructure(clientId);
      showToast(`Cartulina financiada: +${formatMoney(interest)} de intereses. Saldo nuevo ${formatMoney(client.balance)}, ${client.installments} cuotas de ${formatMoney(client.installment)}.`);
    },
  });
}

/**
 * Retanqueo: se le presta un monto extra antes de terminar de pagar. Al extra se le suman
 * intereses (20 %) y se cobran seguros (10 %), salvo que se escriba otro % o un monto exacto.
 * El préstamo sale de la liquidación de hoy y los seguros entran a la base del día.
 */
function openRetanqueoModal() {
  const clientId = state.activeClient;
  const client = clients[clientId];
  if (!client || Number(client.balance) <= 0) return;
  const isWorker = state.userRole !== 'admin';
  if (isWorker && pendingRestructure(pendingRequests, clientId)) { showToast('Esta cartulina ya tiene una solicitud pendiente con el administrador.'); return; }
  openCustomModal({
    title: `${isWorker ? 'Solicitar retanqueo' : 'Retanqueo'} · ${client.name}`,
    description: `Saldo actual ${formatMoney(client.balance)}. Al monto extra se le suman intereses y se cobran seguros; el saldo nuevo arranca un plazo nuevo desde hoy.`,
    fields: [
      { name: 'extra', label: 'Monto extra que se le presta', money: true, thousands: true, type: 'number', min: 1, step: 1, value: '', required: true },
      { type: 'note', label: 'Interés sobre el extra', value: `${RETANQUEO_INTEREST_PERCENT}%`, hint: `General: ${RETANQUEO_INTEREST_PERCENT} % del monto extra`, valueId: 'retanqueo-rate-value', hintId: 'retanqueo-rate-hint' },
      { type: 'checkbox', name: 'customInterest', label: 'Usar un interés diferente al general' },
      { name: 'interestPercent', label: 'Interés del retanqueo (%)', type: 'number', min: 0, max: 100, step: 0.1, value: RETANQUEO_INTEREST_PERCENT, required: true, showWhen: 'customInterest' },
      { type: 'note', className: 'default-rate-note insurance-rate-note', label: 'Seguros', value: formatMoney(0), hint: `General: ${GENERAL_RETANQUEO.insurancePercent} % del monto extra`, valueId: 'retanqueo-insurance-value', hintId: 'retanqueo-insurance-hint' },
      { type: 'checkbox', name: 'customInsurance', label: 'Cobrar un valor de seguros diferente al general' },
      { name: 'insuranceAmount', label: 'Valor de los seguros ($)', money: true, thousands: true, type: 'number', min: 0, step: 1, value: '', required: true, showWhen: 'customInsurance', placeholder: 'Ej. 10' },
      { name: 'insuranceReason', label: '¿Por qué este valor es diferente?', type: 'textarea', rows: 2, value: '', showWhen: 'customInsurance', placeholder: 'Ej. Cliente antiguo, acuerdo especial…' },
      { name: 'totalDays', label: 'Plazo nuevo (días) desde hoy', type: 'number', min: 1, step: 1, value: client.totalDays || 30, required: true },
    ],
    onInput: form => {
      const extra = Math.round(Number(form.elements.extra.value) || 0);
      const percent = form.elements.customInterest.checked ? Number(form.elements.interestPercent.value) || 0 : RETANQUEO_INTEREST_PERCENT;
      document.querySelector('#retanqueo-rate-value').textContent = `${percent}%`;
      document.querySelector('#retanqueo-rate-hint').textContent = extra ? `${percent} % del monto extra = ${formatMoney(percentOrAmount(extra, percent))}` : `${percent} % del monto extra`;
      const insurance = form.elements.customInsurance.checked ? Math.round(Number(form.elements.insuranceAmount.value) || 0) : percentOrAmount(extra, GENERAL_RETANQUEO.insurancePercent);
      document.querySelector('#retanqueo-insurance-value').textContent = formatMoney(insurance);
      document.querySelector('#retanqueo-insurance-hint').textContent = form.elements.customInsurance.checked ? 'Valor diferente al general' : `General: ${GENERAL_RETANQUEO.insurancePercent} % del monto extra`;
    },
    submitLabel: isWorker ? 'Enviar solicitud al admin' : 'Hacer retanqueo',
    onSubmit: values => {
      const extra = Math.round(Number(values.extra) || 0);
      if (extra <= 0) { customModalError.textContent = 'Escribe el monto extra que se le presta.'; return false; }
      const interest = percentOrAmount(extra, values.customInterest ? Number(values.interestPercent) : RETANQUEO_INTEREST_PERCENT);
      const insurance = values.customInsurance ? Math.round(Number(values.insuranceAmount) || 0) : percentOrAmount(extra, GENERAL_RETANQUEO.insurancePercent);
      const insuranceReason = values.customInsurance ? String(values.insuranceReason || '').trim() : '';
      if (insurance > extra) { customModalError.textContent = 'Los seguros no pueden superar el monto extra.'; return false; }
      if (values.customInsurance && !insuranceReason) { customModalError.textContent = 'Escribe por qué los seguros son diferentes al general.'; return false; }
      if (isWorker) {
        sendRestructureRequest(clientId, 'retanqueo', { extra, interest, insurance, insuranceReason, totalDays: Math.round(Number(values.totalDays)), balance: Number(client.balance) });
        return;
      }
      retanqueoCard(client, { extra, interest, insurance, insuranceReason, totalDays: values.totalDays });
      recordRetanqueoInRoute(routeSettlements[client.route], client, clientId, { extra, interest, insurance });
      afterRestructure(clientId);
      showToast(`Retanqueo de ${formatMoney(extra)}: intereses ${formatMoney(interest)}, seguros ${formatMoney(insurance)}. Saldo nuevo ${formatMoney(client.balance)}.`);
    },
  });
}

function __mount_clientDetailModule() {
  document.querySelector('#card-prev').addEventListener('click', () => moveToCard(-1));
  document.querySelector('#card-next').addEventListener('click', () => moveToCard(1));
  document.querySelector('#finance-client').addEventListener('click', openFinanceModal);
  document.querySelector('#retanqueo-client').addEventListener('click', openRetanqueoModal);
  document.querySelector('#client-capture-location').addEventListener('click', captureClientLocation);
  // La ubicación llegó tarde (reintento tras crear la cartulina): se actualiza la ficha abierta.
  document.addEventListener('edgecredit:client-location', event => {
    const client = clients[event.detail?.clientId];
    if (client && state.activeClient === event.detail.clientId) { renderLocationLink(client); renderLocationPending(client); }
  });
  onClientRenewed(clientId => openClient(clientId));
  document.querySelector('#person-cards-list').addEventListener('click', event => {
    const chip = event.target.closest('[data-person-card]');
    if (!chip || chip.dataset.personCard === state.activeClient) return;
    const back = state.previousView;
    openClient(chip.dataset.personCard);
    state.previousView = back;
  });
  disclosureButton.addEventListener('click', toggleDisclosure);
  // El historial de direcciones vive dentro del panel desplegable: al abrirlo, recalcula su alto.
  document.querySelector('#address-history').addEventListener('toggle', () => {
    if (creditDetails.classList.contains('is-expanded')) creditDetails.style.maxHeight = `${creditDetails.scrollHeight}px`;
  });
  const notesInput = document.querySelector('#client-notes-input');
  notesInput.addEventListener('input', () => {
    document.querySelector('#save-client-notes').disabled = notesInput.value === notesInput.dataset.saved;
    document.querySelector('#client-notes-status').textContent = notesInput.value === notesInput.dataset.saved ? '' : 'Cambios sin guardar';
  });
  document.querySelector('#save-client-notes').addEventListener('click', saveClientNotes);
  document.querySelector('#edit-client').addEventListener('click', () => {
    if (state.userRole !== 'admin') return;
    const client = clients[state.activeClient];
    // Día de cobro de las semanales (define su color). Domingo solo aparece si ya quedó así.
    const currentPayday = client.creditStartDate ? weekdayOf(client.creditStartDate) : 1;
    const paydayOptions = PAYDAY_OPTIONS.map(option => ({ value: String(option.weekday), label: option.label }));
    if (currentPayday === 0) paydayOptions.unshift({ value: '0', label: 'Domingo (sin color)' });
    // Diaria, quincenal o mensual entregada (o iniciada) un domingo: se guarda con la fecha del sábado o del lunes.
    const sunday = client.deliveredOn && weekdayOf(client.deliveredOn) === 0 ? client.deliveredOn : currentPayday === 0 ? client.creditStartDate : null;
    const shiftValue = !sunday ? '' : client.creditStartDate === shiftDays(sunday, -1) ? 'prev' : client.creditStartDate === shiftDays(sunday, 1) ? 'next' : client.creditStartDate === sunday ? 'sun' : '';
    const shiftField = sunday && (client.frequency || 'weekly') !== 'weekly' && shiftValue
      ? [{ name: 'sundayShift', label: 'Entregada un domingo · fecha con que se guarda', type: 'select', value: shiftValue, options: [
        ...(shiftValue === 'sun' ? [{ value: 'sun', label: `Domingo ${formatDate(sunday)}` }] : []),
        { value: 'prev', label: `Sábado ${formatDate(shiftDays(sunday, -1))} · día anterior` },
        { value: 'next', label: `Lunes ${formatDate(shiftDays(sunday, 1))} · día siguiente` },
      ] }]
      : [];
    openCustomModal({
      title: 'Editar cartulina completa', description: 'Actualiza los datos personales, financieros y el calendario del crédito.',
      fields: [
        { name: 'name', label: 'Nombre completo', value: client.name, required: true },
        { name: 'id', label: 'Cédula', value: client.id, required: true },
        { name: 'phone', label: 'Teléfono', value: client.phone, required: true },
        { name: 'address', label: 'Dirección principal', value: client.address, required: true },
        { name: 'altAddress', label: 'Dirección alternativa (trabajo u otro lugar) · opcional', value: client.altAddress || '' },
        { name: 'addressNotes', label: 'Indicaciones del domicilio', type: 'textarea', rows: 2, value: client.addressNotes || '' },
        { name: 'route', label: 'Ruta / nombre del cobro', type: 'text', value: routeSettlements[client.route]?.name || client.route, required: true },
        { name: 'frequency', label: 'Frecuencia de pago', type: 'select', value: client.frequency || 'weekly', options: Object.entries(paymentFrequencyLabels).map(([value, label]) => ({ value, label })) },
        ...((client.frequency || 'weekly') === 'weekly' ? [{ name: 'paymentWeekday', label: 'Día de cobro (define el color)', type: 'select', value: String(currentPayday), options: paydayOptions }] : shiftField),
        { name: 'principal', label: 'Capital prestado ($)', type: 'number', min: 0, step: 1, value: inferClientPrincipal(client), required: true },
        { name: 'total', label: 'Valor total del crédito ($)', type: 'number', min: 0, step: 1, value: client.total, required: true },
        { name: 'balance', label: 'Saldo pendiente ($)', type: 'number', min: 0, step: 1, value: client.balance, required: true },
        { name: 'installment', label: 'Valor de cuota ($)', type: 'number', min: 0, step: 1, value: client.installment, required: true },
        { name: 'interestPercent', label: 'Interés (%)', type: 'number', min: 0, step: 0.1, value: client.interestPercent ?? 20, required: true },
        { name: 'insuranceAmount', label: `Seguros cobrados ($) · general: ${formatMoney(generalInsuranceAmount(inferClientPrincipal(client)))}`, type: 'number', min: 0, step: 1, value: clientInsurance(client).amount, required: true },
        { name: 'insuranceReason', label: 'Motivo si los seguros son diferentes al 10%', type: 'textarea', rows: 2, value: clientInsurance(client).reason },
        { name: 'paid', label: 'Cuotas pagadas', type: 'number', min: 0, step: 1, value: client.paid, required: true },
        { name: 'installments', label: 'Total de cuotas', type: 'number', min: 1, step: 1, value: client.installments, required: true },
        { name: 'creditStartDate', label: 'Fecha de inicio de la cartulina (si la cambias, manda sobre el día de cobro y los días que lleva)', type: 'date', value: client.creditStartDate || localDateISO(), required: true },
        { type: 'note', className: 'default-rate-note start-color-note', label: 'Color de la cartulina', value: startColorLabel(client.frequency || 'weekly', client.creditStartDate), valueId: 'edit-start-color', hint: 'Las semanales toman el color del día de la semana en que inicia.' },
        { name: 'routeDay', label: 'Días que lleva el crédito', type: 'number', min: 0, step: 1, value: creditDay(client), required: true },
        { name: 'totalDays', label: 'Duración acordada (días)', type: 'number', min: 1, step: 1, value: client.totalDays, required: true },
        { name: 'status', label: 'Estado', type: 'select', value: client.late ? 'late' : 'current', options: [{ value: 'current', label: 'Al día' }, { value: 'late', label: 'Mora' }] },
      ],
      onSubmit: values => {
        const oldPrincipal = inferClientPrincipal(client);
        const oldState = { route: client.route, principal: oldPrincipal, total: Number(client.total) };
        if (Number(values.interestPercent) > 100) {
          customModalError.textContent = 'El interés debe estar entre 0 y 100%.';
          return false;
        }
        const startChanged = values.creditStartDate !== (client.creditStartDate || localDateISO());
        if (startChanged && !/^\d{4}-\d{2}-\d{2}$/.test(values.creditStartDate || '')) { customModalError.textContent = 'Escribe la fecha de inicio de la cartulina.'; return false; }
        if (startChanged && weekdayOf(values.creditStartDate) === 0) {
          customModalError.textContent = 'Esa fecha es domingo y las cartulinas no inician en domingo (quedaría sin color). Elige el sábado o el lunes.';
          return false;
        }
        const insurance = resolveInsurance(values.principal, true, values.insuranceAmount, values.insuranceReason);
        if (insurance.error) { customModalError.textContent = insurance.error; return false; }
        if (Number(values.paid) > Number(values.installments)) {
          customModalError.textContent = 'Las cuotas pagadas no pueden superar el total de cuotas.';
          return false;
        }
        const duplicateId = Object.entries(clients).some(([id, item]) => id !== state.activeClient && item.id === values.id.trim());
        if (duplicateId) { customModalError.textContent = 'Ya existe otro cliente con esa cédula.'; return false; }
        const newClientRoute = ensureRoute(values.route);
        if (!newClientRoute) { customModalError.textContent = 'Escribe el nombre de la ruta / cobro.'; return false; }
        client.name = values.name.trim();
        client.id = values.id.trim();
        client.phone = values.phone.trim();
        // Historial: toda dirección reemplazada queda guardada con fecha. La ubicación GPS
        // anterior deja de valer para la nueva dirección y se conserva en el historial.
        const changedAt = new Date().toISOString();
        client.addressHistory ||= [];
        const newAddress = values.address.trim();
        const newAltAddress = (values.altAddress || '').trim();
        let relocate = false;
        if (newAddress !== client.address) {
          client.addressHistory.push({ type: 'principal', address: client.address, replacedBy: newAddress, location: client.location || null, changedAt, changedBy: 'Administrador' });
          client.address = newAddress;
          if (client.location) { client.location = null; relocate = true; }
        }
        if (newAltAddress !== (client.altAddress || '')) {
          if (client.altAddress) client.addressHistory.push({ type: 'alternativa', address: client.altAddress, replacedBy: newAltAddress || '(eliminada)', location: client.altLocation || null, changedAt, changedBy: 'Administrador' });
          client.altAddress = newAltAddress;
          client.altLocation = null;
        }
        client.addressNotes = (values.addressNotes || '').trim();
        if (relocate) window.setTimeout(() => showToast(`La dirección de ${client.name} cambió: ubícala de nuevo en el Mapa de clientes.`), 50);
        client.route = newClientRoute;
        client.frequency = paymentFrequencyDays[values.frequency] ? values.frequency : 'weekly';
        client.principal = Number(values.principal);
        client.total = Number(values.total);
        client.balance = Number(values.balance);
        client.settledAt = client.balance <= 0 ? client.settledAt || localDateISO() : null;
        client.installment = Number(values.installment);
        client.interestPercent = Number(values.interestPercent);
        client.insurancePercent = null;
        client.insuranceAmount = insurance.amount;
        client.insuranceCustom = insurance.custom;
        client.insuranceReason = insurance.reason;
        client.paid = Number(values.paid);
        client.schedulePaidBaseline = Number(values.paid);
        client.installments = Number(values.installments);
        const startBefore = client.creditStartDate;
        if (startChanged) {
          // Fecha de inicio escrita por el admin: manda sobre los días que lleva y el día de cobro.
          // El color sale solo de esa fecha (día de la semana en las semanales).
          client.creditStartDate = values.creditStartDate;
        } else {
          // Corregir los días mueve la fecha de inicio: así siguen subiendo solos cada día.
          if (Number(values.routeDay) !== creditDay(client)) client.creditStartDate = startDateForCreditDay(values.routeDay);
          // Cambiar el día de cobro mueve el inicio a ese día de la semana.
          const payday = Number(values.paymentWeekday);
          if (client.frequency === 'weekly' && client.creditStartDate && payday >= 1 && payday <= 6 && payday !== weekdayOf(client.creditStartDate)) {
            client.creditStartDate = startDateForPayday(client, payday);
          }
          if (client.frequency !== 'weekly' && sunday && (values.sundayShift === 'prev' || values.sundayShift === 'next') && values.sundayShift !== shiftValue) {
            client.creditStartDate = shiftDays(sunday, values.sundayShift === 'prev' ? -1 : 1);
          }
        }
        // Con otra fecha de inicio los abonos se reubican en sus cuotas.
        if (client.creditStartDate !== startBefore) reassignPaymentCycles(client);
        client.routeDay = creditDay(client);
        client.totalDays = Number(values.totalDays);
        client.term = `${client.totalDays} días`;
        client.status = values.status === 'late' ? 'Mora' : 'Al día';
        client.late = values.status === 'late';
        client.progress = client.installments ? Math.round((client.paid / client.installments) * 100) : 0;
        client.breakdown = `${formatMoney(client.principal)} / ${formatMoney(client.total - client.principal)}`;
        client.initials = client.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
        updateClientLoanAccounting(client, state.activeClient, oldState, { route: client.route, principal: client.principal, total: client.total });
        syncCancelledCard(client, state.activeClient);
        if (routeSelect.value === oldState.route || routeSelect.value === client.route) renderAdminRoute(routeSelect.value);
        persistBusinessData();
        const returnView = state.previousView;
        openClient(state.activeClient);
        state.previousView = returnView;
        renderClientRows(state.activeClient);
        filterClientCards();
      }
    });
  });
  // Editar cartulina: el color se actualiza en vivo al cambiar la fecha de inicio o la frecuencia.
  const refreshStartColor = event => {
    const form = event.target.closest?.('#custom-modal-form');
    const note = document.querySelector('#edit-start-color');
    if (!form || !note || !['creditStartDate', 'frequency'].includes(event.target.name)) return;
    note.textContent = startColorLabel(form.elements.frequency?.value || 'weekly', form.elements.creditStartDate?.value);
    customModalError.textContent = '';
  };
  document.addEventListener('input', refreshStartColor);
  document.addEventListener('change', refreshStartColor);
  // Abonos del día (Resumen del día del trabajador): tocar el cliente abre su cartulina.
  document.addEventListener('click', event => {
    const target = event.target.closest?.('[data-open-client]');
    if (target && clients[target.dataset.openClient]) openClient(target.dataset.openClient);
  });
  document.querySelector('#delete-client').addEventListener('click', () => removeClient(state.activeClient));
  document.querySelector('#payment-history-list').addEventListener('click', event => {
    const button = event.target.closest('[data-payment-action]');
    if (!button || state.userRole !== 'admin') return;
    const client = clients[state.activeClient];
    const index = Number(button.dataset.paymentIndex);
    if (!client.payments[index]) return;
    if (button.dataset.paymentAction === 'delete') {
      openCustomModal({
        title: 'Eliminar abono', description: `Se eliminará el abono de ${formatDate(client.payments[index].date)}.`, submitLabel: 'Eliminar',
        onSubmit: () => { const amount = Number(client.payments[index].amount) || 0; client.balance += amount; client.payments.splice(index, 1); if (routeSettlements[client.route]) routeSettlements[client.route].collections = Math.max(0, routeSettlements[client.route].collections - amount); updatePaidAmountTotal(client); client.settledAt = Number(client.balance) <= 0 ? client.settledAt || localDateISO() : null; syncCancelledCard(client, state.activeClient); persistBusinessData(); openClient(state.activeClient); }
      });
    } else {
      const oldAmount = Number(client.payments[index].amount) || 0;
      openCustomModal({
        title: 'Editar abono', description: `Actualiza el monto registrado el ${formatDate(client.payments[index].date)}.`,
        fields: [{ name: 'amount', label: 'Monto del abono', money: true, thousands: true, type: 'number', min: 1, step: 1, value: client.payments[index].amount, required: true }],
        onSubmit: values => {
          const amount = Number(values.amount);
          if (amount > oldAmount + Number(client.balance)) { customModalError.textContent = 'El monto corregido supera el saldo disponible.'; return false; }
          client.balance = Math.max(0, Number(client.balance) + oldAmount - amount);
          client.payments[index].amount = amount;
          if (routeSettlements[client.route]) routeSettlements[client.route].collections = Math.max(0, routeSettlements[client.route].collections + amount - oldAmount);
          client.settledAt = client.balance <= 0 ? client.settledAt || localDateISO() : null;
          updatePaidAmountTotal(client); syncCancelledCard(client, state.activeClient); persistBusinessData(); openClient(state.activeClient);
        }
      });
    }
  });
  document.querySelector('#payment-history-toggle').addEventListener('click', () => {
    if (expandedPaymentHistory.has(state.activeClient)) expandedPaymentHistory.delete(state.activeClient);
    else expandedPaymentHistory.add(state.activeClient);
    renderHistory(clients[state.activeClient]);
  });
}

// ── js/features/clients/directory.js
/**
 * features/clients/directory · Tarjetas de clientes, filtro por ruta/búsqueda
 * y reordenamiento del directorio (drag & drop y táctil).
 */















/**
 * Agrega las filas del cliente en el Inicio y el directorio. Al cargar muchos clientes de una vez
 * se pasa `{ refresh: false }` y se filtra una sola vez al final (filtrar por cada uno es muy lento).
 */
function appendClientCards(clientId, { refresh = true } = {}) {
  const client = clients[clientId];
  document.querySelectorAll('#inicio .client-list, #directorio .client-list').forEach(list => {
    const isHome = Boolean(list.closest('#inicio'));
    // En el Inicio la fila es un contenedor (lleva botones de acción); en el directorio, un botón.
    const card = document.createElement(isHome ? 'div' : 'button');
    if (!isHome) card.type = 'button';
    card.className = isHome ? 'client-row home-client-row' : 'client-row';
    card.dataset.client = clientId;
    card.dataset.route = client.route;
    const avatar = clientAvatarWithProgress(client);
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

/** Foto (o iniciales) dentro del anillo con el porcentaje pagado de la cartulina. */
function clientAvatarWithProgress(client, { small = false } = {}) {
  const ring = document.createElement('span');
  ring.className = small ? 'avatar-progress is-small' : 'avatar-progress';
  const avatar = document.createElement('span');
  avatar.className = 'client-avatar avatar-blue';
  setClientAvatar(avatar, client);
  ring.append(avatar);
  paintAvatarProgress(ring, client);
  return ring;
}

function paintAvatarProgress(ring, client) {
  const percent = paidPercent(client);
  ring.style.setProperty('--progress', `${percent * 3.6}deg`);
  ring.title = `${percent}% pagado`;
}

function setClientAvatar(element, client) {
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

function renderClientRows(clientId) {
  const client = clients[clientId];
  document.querySelectorAll(`.client-row[data-client="${clientId}"] .client-main strong`).forEach(node => { node.textContent = client.name; });
  document.querySelectorAll(`.client-row[data-client="${clientId}"] .client-avatar`).forEach(node => setClientAvatar(node, client));
  document.querySelectorAll(`.client-row[data-client="${clientId}"] .avatar-progress`).forEach(ring => paintAvatarProgress(ring, client));
  document.querySelectorAll(`.client-row[data-client="${clientId}"]`).forEach(row => {
    row.dataset.route = client.route;
    // Franja de color en el borde superior (día de pago / quincenal / mensual).
    let band = row.querySelector(':scope > .card-color-band');
    if (!band) { band = document.createElement('span'); band.className = 'card-color-band'; row.prepend(band); }
    paintCardColorBand(band, client, row);
    const main = row.querySelector('.client-main');
    const description = main?.querySelector(':scope > span:not(.client-risk-line)');
    // Si la persona tiene varias cartulinas, cada fila indica cuál es.
    const card = isActiveCard(client) ? cardLabel(clients, clientId) : '';
    const cardTag = card ? ` · ${card}` : '';
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

function removeClient(clientId) {
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

function filterClientCards() {
  const route = state.userRole === 'admin' ? routeSelect.value : state.workerRoute;
  const directoryQuery = normalizeSearch(document.querySelector('#directory-search')?.value.trim());
  const homeQuery = normalizeSearch(document.querySelector('#home-search')?.value.trim());
  const todayOrder = todayRouteOrder(route);
  document.querySelectorAll('#worker-view [data-client][data-route]').forEach(card => {
    const matchesRoute = card.dataset.route === route;
    const exists = Object.prototype.hasOwnProperty.call(clients, card.dataset.client);
    const homeClient = clients[card.dataset.client];
    const inHome = Boolean(card.closest('#inicio .client-list'));
    // Cada lista tiene su buscador (Inicio y Directorio); se busca por nombre o cédula.
    const query = inHome ? homeQuery : directoryQuery;
    const matchesQuery = !query || normalizeSearch(card.textContent).includes(query) || (exists && normalizeSearch(homeClient.id).includes(query));
    // Inicio: solo cartulinas activas de la ruta del día que aún no se visitaron hoy
    // (al registrar un abono o "No pagó hoy" la fila desaparece del Inicio). Si el trabajador
    // todavía no armó la ruta del día, el Inicio queda vacío (solo el aviso). Al buscar en el
    // Inicio aparecen todas las cartulinas activas de la ruta que coincidan.
    const dailySelected = !inHome || (exists && Number(homeClient.balance) > 0 && (homeQuery || (visitStatus(card.dataset.client) === 'pending' && (todayOrder.includes(card.dataset.client) || (!todayOrder.length && state.userRole !== 'worker')))));
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
function __mount_directoryModule() {
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
  document.querySelector('#home-search')?.addEventListener('input', filterClientCards);
}

// ── js/features/clients/interest.js
/**
 * features/clients/interest · Interés moratorio (tarifa general o monto específico).
 */





function closeInterestModal() {
  interestModal.hidden = true;
  specificInterestForm.hidden = true;
  specificInterestForm.reset();
  if (customModal.hidden && newClientModal.hidden && modal.hidden) document.body.classList.remove('modal-open');
}

function applyInterest(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const client = clients[state.activeClient];
  client.balance += amount;
  client.interestHistory.unshift({ date: new Date().toISOString().slice(0, 10), amount });
  persistBusinessData();
  refreshClientBalance();
  renderHistory(client);
  closeInterestModal();
}

function openInterestModal() {
  interestModal.hidden = false;
  document.body.classList.add('modal-open');
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_interestModule() {
  interestToggle.addEventListener('click', openInterestModal);
  document.querySelector('#apply-general-interest').addEventListener('click', () => applyInterest(clients[state.activeClient].generalInterest));
  document.querySelector('#choose-specific-interest').addEventListener('click', () => {
    specificInterestForm.hidden = false;
    specificInterestInput.focus();
  });
  specificInterestForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!specificInterestForm.reportValidity()) return;
    applyInterest(Number(specificInterestInput.value));
  });
  document.querySelectorAll('[data-close-interest]').forEach(button => button.addEventListener('click', closeInterestModal));
  interestModal.addEventListener('click', event => { if (event.target === interestModal) closeInterestModal(); });
}

// ── js/features/clients/new-client.js
/**
 * features/clients/new-client · Alta de clientes, renovación de créditos, seguros
 * (10% general o valor propio con motivo) y solicitudes de excepción de interés.
 */


















// Cartulina de origen cuando el modal está en modo «Renovar crédito» (linkMode 'renew')
// o «Otra cartulina» para la misma persona (linkMode 'extra').
let renewSourceId = null;
let linkMode = null;

// ── Posición del nuevo cliente en la ruta (antes / después de otro cliente) ──
let positionRefId = null;

function positionRouteId() {
  return state.userRole === 'admin' ? routeSelect.value : state.workerRoute;
}

/** Orden actual de la ruta: el guardado por el trabajador y luego los demás clientes del cobro. */
function currentRouteOrder(routeId) {
  const ids = Object.keys(clients).filter(id => clients[id].route === routeId);
  const saved = (state.clientLibraryOrder[routeId] || []).filter(id => ids.includes(id));
  return [...saved, ...ids.filter(id => !saved.includes(id))];
}

function renderPositionResults() {
  const results = document.querySelector('#route-position-results');
  results.replaceChildren();
  const term = normalizeSearch(document.querySelector('#route-position-search').value.trim());
  if (!term) return;
  const routeId = positionRouteId();
  const order = currentRouteOrder(routeId);
  const matches = order.filter(id => Number(clients[id].balance) > 0 && normalizeSearch(`${clients[id].name} ${clients[id].id}`).includes(term)).slice(0, 6);
  if (!matches.length) {
    results.append(Object.assign(document.createElement('p'), { className: 'route-position-empty', textContent: 'No hay clientes con ese nombre o cédula en este cobro.' }));
    return;
  }
  matches.forEach(id => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'route-position-option';
    option.setAttribute('role', 'option');
    option.dataset.positionClient = id;
    const name = document.createElement('strong');
    name.textContent = clients[id].name;
    const meta = document.createElement('small');
    meta.textContent = `#${order.indexOf(id) + 1} en la ruta · Cédula ${clients[id].id}`;
    option.append(name, meta);
    results.append(option);
  });
}

function selectPosition(id) {
  positionRefId = id;
  const selected = document.querySelector('#route-position-selected');
  selected.hidden = !id;
  document.querySelector('#route-position-name').textContent = id ? clients[id].name : '';
  document.querySelector('#route-position-search').value = '';
  document.querySelector('#route-position-results').replaceChildren();
  document.querySelector('.route-position-search').hidden = Boolean(id);
}

/** Inserta al cliente nuevo en el orden de la ruta, antes o después del elegido. */
function placeInRoute(routeId, clientId) {
  if (!positionRefId || !clients[positionRefId] || clients[positionRefId].route !== routeId) return;
  const where = document.querySelector('input[name="routePositionWhere"]:checked')?.value === 'before' ? 'before' : 'after';
  const order = currentRouteOrder(routeId).filter(id => id !== clientId);
  const index = order.indexOf(positionRefId);
  order.splice(where === 'before' ? index : index + 1, 0, clientId);
  state.clientLibraryOrder[routeId] = order;
}

function setAltAddressOpen(open) {
  const toggle = document.querySelector('#toggle-alt-address');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.classList.toggle('is-open', open);
  toggle.innerHTML = open ? '<span aria-hidden="true">−</span> Quitar dirección alternativa' : '<span aria-hidden="true">＋</span> Dirección alternativa';
  document.querySelector('#alt-address-field').hidden = !open;
  const input = document.querySelector('#alt-address-input');
  input.required = open;
  if (!open) input.value = '';
  else window.setTimeout(() => input.focus(), 20);
}

function updateInsurancePreview() {
  const principal = Number(newClientForm.elements.principal.value) || 0;
  document.querySelector('#insurance-general-amount').textContent = formatMoney(generalInsuranceAmount(principal));
}

function setInsuranceCustom(open) {
  document.querySelector('#insurance-custom-toggle').checked = open;
  document.querySelector('#insurance-custom-fields').hidden = !open;
  document.querySelector('#insurance-custom-amount').required = open;
  document.querySelector('#insurance-custom-reason').required = open;
  if (open) window.setTimeout(() => document.querySelector('#insurance-custom-amount').focus(), 20);
}

const LINK_COPY = {
  renew: { title: 'Renovar crédito', kind: 'RENOVACIÓN', submit: 'Renovar crédito', description: 'La cartulina anterior ya está cancelada. Se crea una nueva con los mismos datos: elige el nuevo monto y, si cambió, actualiza la dirección.' },
  extra: { title: 'Otra cartulina', kind: 'CARTULINA ADICIONAL', submit: 'Crear cartulina', description: 'Se abre un crédito adicional a nombre de la misma persona. Las demás cartulinas siguen activas y se cobran por separado.' },
};

/**
 * Activa el modo vinculado a una cartulina existente (renovar u otra cartulina):
 * identidad fija, sin foto nueva (se usa la registrada) y sin elegir posición.
 */
function setLinkedMode(sourceId, mode) {
  renewSourceId = sourceId;
  linkMode = sourceId ? mode : null;
  const linked = Boolean(linkMode);
  const copy = LINK_COPY[linkMode];
  ['name', 'idNumber', 'phone'].forEach(name => { newClientForm.elements[name].readOnly = linked; });
  // La foto es opcional por ahora: las fotos pesan y el sistema todavía carga todo al abrir.
  document.querySelector('#client-photo-input').required = false;
  document.querySelector('.client-photo-field').hidden = linked;
  document.querySelector('.route-position-field').hidden = linked;
  document.querySelector('#new-client-title').textContent = copy?.title || 'Registrar cliente';
  document.querySelector('#new-client-kind').textContent = copy?.kind || 'NUEVO CRÉDITO';
  document.querySelector('#new-client-submit').innerHTML = `${copy?.submit || 'Crear cliente'} <span aria-hidden="true">→</span>`;
  document.querySelector('#new-client-description').textContent = copy?.description || 'Las excepciones de interés quedan pendientes de aprobación del administrador.';
  const linkedPhoto = document.querySelector('#linked-photo');
  const note = document.querySelector('#renewal-note');
  linkedPhoto.hidden = true;
  note.hidden = true;
  if (!linked) return;
  const source = clients[sourceId];
  const photo = document.querySelector('#linked-photo-img');
  if (source.photoData) photo.src = source.photoData; else photo.removeAttribute('src');
  photo.hidden = !source.photoData;
  document.querySelector('#linked-photo-text').textContent = source.photoData
    ? 'Se usa la foto ya registrada de esta persona.'
    : 'Esta persona no tiene foto registrada; puede agregarse luego desde «Editar cliente».';
  linkedPhoto.hidden = false;
  if (linkMode === 'extra') {
    const active = activeCardIds(clients, source.id).length;
    note.hidden = false;
    note.textContent = `${source.name} tiene ${active} cartulina${active === 1 ? '' : 's'} activa${active === 1 ? '' : 's'}. Esta será la ${active + 1} de máximo ${MAX_ACTIVE_CARDS_PER_PERSON}.`;
  }
}

/**
 * Los domingos no hay cobro: una cartulina creada ese día no arranca en domingo.
 * Semanal: se elige el día de cobro (lunes a sábado) y toma su color. Diaria, quincenal o
 * mensual: se guarda con fecha del sábado (día anterior) o del lunes (día siguiente).
 * Solo aparece los domingos.
 */
const SUNDAY_SHIFT_OPTIONS = [
  { value: 'prev', label: 'Sábado · día anterior' },
  { value: 'next', label: 'Lunes · día siguiente' },
];

function updateSundayPayday() {
  const box = document.querySelector('#sunday-payday');
  const show = weekdayOf(localDateISO()) === 0;
  const mode = newClientForm.elements.frequency.value === 'weekly' ? 'weekly' : 'shift';
  box.hidden = !show;
  const options = document.querySelector('#sunday-payday-options');
  if (options.dataset.mode !== mode) {
    options.dataset.mode = mode;
    options.classList.toggle('is-shift', mode === 'shift');
    document.querySelector('#sunday-payday-title').textContent = mode === 'weekly' ? 'Hoy es domingo · ¿qué día va a pagar?' : 'Hoy es domingo · ¿con qué fecha se guarda?';
    document.querySelector('#sunday-payday-copy').textContent = mode === 'weekly'
      ? 'La cartulina semanal se guarda con el día de cobro que elijas y toma su color. El crédito empieza a contar desde ese día.'
      : 'Para que la cartulina no quede con fecha de domingo, elige si se guarda con la fecha de ayer (sábado) o de mañana (lunes). El crédito cuenta desde esa fecha.';
    const choices = mode === 'weekly'
      ? PAYDAY_OPTIONS.map(option => ({ value: String(option.weekday), label: option.label, color: option.color, ink: option.ink }))
      : SUNDAY_SHIFT_OPTIONS;
    options.replaceChildren(...choices.map(choice => {
      const label = document.createElement('label');
      label.className = 'sunday-payday-option';
      if (choice.color) {
        label.style.setProperty('--card-color', choice.color);
        label.style.setProperty('--card-color-ink', choice.ink);
      }
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'paymentWeekday';
      input.value = choice.value;
      const text = document.createElement('span');
      text.textContent = choice.label;
      label.append(input, text);
      return label;
    }));
  }
  options.querySelectorAll('input').forEach(input => {
    input.required = show;
    input.disabled = !show;
  });
}

function openNewClientModal() {
  if (state.userRole !== 'worker' && state.userRole !== 'admin') return;
  newClientError.textContent = '';
  newClientForm.reset();
  document.querySelector('#client-photo-preview').hidden = true;
  document.querySelector('#client-photo-preview').removeAttribute('src');
  const isAdmin = state.userRole === 'admin';
  // La ruta la define el cobro abierto (admin: el seleccionado; trabajador: el suyo).
  const openRoute = routeSettlements[isAdmin ? routeSelect.value : state.workerRoute];
  document.querySelector('#new-client-route').textContent = `RUTA ${(openRoute?.name || '').toLocaleUpperCase('es')}`;
  // El admin fija interés y seguros directamente: no necesita "solicitar excepciones".
  document.querySelector('#default-rate-note').hidden = isAdmin;
  document.querySelector('#admin-rate-fields').hidden = !isAdmin;
  document.querySelector('#admin-interest-percent').required = isAdmin;
  document.querySelector('#interest-exception-toggle-wrap').hidden = isAdmin;
  document.querySelector('#interest-worker-comment-wrap').hidden = isAdmin;
  document.querySelector('#interest-admin-value-wrap').hidden = !isAdmin;
  document.querySelector('#admin-no-base-impact-wrap').hidden = !isAdmin;
  document.querySelector('#interest-exception-fields').hidden = true;
  document.querySelector('#interest-exception-value').required = false;
  document.querySelector('#interest-exception-comment').required = false;
  setAltAddressOpen(false);
  selectPosition(null);
  setInsuranceCustom(false);
  setLinkedMode(null);
  updateInsurancePreview();
  updateSundayPayday();
  newClientModal.hidden = false;
  newClientModal.classList.add('active');
  document.body.classList.add('modal-open');
  window.setTimeout(() => newClientForm.querySelector('input')?.focus(), 20);
}

/** Renovar: solo cuando la cartulina está cancelada (saldo en cero) y no se ha renovado antes. */
function canRenew(clientId) {
  const client = clients[clientId];
  return Boolean(client) && Number(client.balance) <= 0 && !(client.renewedTo && clients[client.renewedTo]);
}

function openRenewalModal(sourceId) {
  if (!canRenew(sourceId)) {
    const source = clients[sourceId];
    showToast(source && Number(source.balance) > 0
      ? `Para renovar, primero hay que pagar lo que falta de esta cartulina: ${formatMoney(source.balance)}. Si necesita otro préstamo sin cancelar, usa «＋ Otra cartulina».`
      : 'Esta cartulina ya fue renovada.');
    return;
  }
  openLinkedModal(sourceId, 'renew');
}

/** Otra cartulina simultánea para la misma persona (hasta el máximo permitido). */
function openExtraCardModal(sourceId) {
  const source = clients[sourceId];
  if (!source) return;
  if (!canAddCard(clients, source.id)) {
    showToast(`${source.name} ya tiene ${MAX_ACTIVE_CARDS_PER_PERSON} cartulinas activas, el máximo permitido.`);
    return;
  }
  openLinkedModal(sourceId, 'extra');
}

function openLinkedModal(sourceId, mode) {
  const source = clients[sourceId];
  if (!source) return;
  openNewClientModal();
  setLinkedMode(sourceId, mode);
  const routeName = routeSettlements[source.route]?.name || source.route;
  document.querySelector('#new-client-route').textContent = `RUTA ${String(routeName).toLocaleUpperCase('es')}`;
  const fields = newClientForm.elements;
  fields.name.value = source.name;
  fields.idNumber.value = source.id;
  fields.phone.value = source.phone;
  fields.address.value = source.address || '';
  fields.addressNotes.value = source.addressNotes || '';
  fields.totalDays.value = source.totalDays || '';
  fields.frequency.value = paymentFrequencyDays[source.frequency] ? source.frequency : 'weekly';
  updateSundayPayday();
  if (source.altAddress) { setAltAddressOpen(true); document.querySelector('#alt-address-input').value = source.altAddress; }
  if (state.userRole === 'admin') document.querySelector('#admin-interest-percent').value = source.interestPercent ?? 20;
  updateInsurancePreview();
  window.setTimeout(() => fields.principal.focus(), 30);
}

function closeNewClientModal() {
  newClientModal.hidden = true;
  newClientModal.classList.remove('active');
  newClientForm.reset();
  document.querySelector('#client-photo-preview').hidden = true;
  document.querySelector('#client-photo-preview').removeAttribute('src');
  document.querySelector('#client-photo-file-name').textContent = 'Ningún archivo seleccionado';
  setLinkedMode(null);
  if (customModal.hidden && interestModal.hidden && modal.hidden) document.body.classList.remove('modal-open');
}

/**
 * `gps`: resultado de locateDevice() tomado al pulsar crear, o null si no se pidió
 * (admin, o renovación sin cambio de dirección que conserva la ubicación anterior).
 */
function addNewClient(values, photoData = '', insurance, gps = null) {
  const clientId = `client-${Date.now()}`;
  const principal = Math.round(Number(values.principal));
  const interestException = document.querySelector('#interest-exception-toggle').checked;
  const isAdmin = state.userRole === 'admin';
  const source = renewSourceId ? clients[renewSourceId] : null;
  const mode = source ? linkMode : null;
  const interestPercent = isAdmin ? Number(values.adminInterestPercent) : 20;
  const today = localDateISO();
  const total = Math.round(principal * (1 + interestPercent / 100));
  const name = values.name.trim();
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const totalDays = Math.max(1, Math.round(Number(values.totalDays)));
  const frequency = paymentFrequencyDays[values.frequency] ? values.frequency : 'weekly';
  const installments = Math.max(1, Math.ceil(totalDays / paymentFrequencyDays[frequency]));
  const assignedRoute = source ? source.route : isAdmin ? routeSelect.value : state.workerRoute;
  const route = routeSettlements[assignedRoute];
  const noBaseImpact = isAdmin && document.querySelector('#admin-no-base-impact').checked;
  clients[clientId] = {
    name, initials, route: assignedRoute, balance: total, principal, installment: Math.ceil(total / installments),
    status: 'Al día', late: false, id: values.idNumber.trim(), address: values.address.trim(), altAddress: (values.altAddress || '').trim(), addressHistory: [], phone: values.phone.trim(),
    total, term: `${totalDays} días`, breakdown: `${formatMoney(principal)} / ${formatMoney(total - principal)}`,
    paid: 0, installments, progress: 0, routeDay: 1, totalDays, generalInterest: 0,
    interestPercent, insurancePercent: null, insuranceAmount: insurance.amount, insuranceCustom: insurance.custom, insuranceReason: insurance.reason, insuranceCollectedAt: today, insuranceCollectedTs: Date.now(),
    addressNotes: (values.addressNotes || '').trim(), notes: '', notesUpdatedAt: null, notesUpdatedBy: null, payments: [], interestHistory: [], noBaseImpact,
    frequency, creditStartDate: today, visitHistory: [], paymentWarning: false, paidPeriodIndexes: [], schedulePaidBaseline: 0, photoData, totalPaidAmount: 0, settledAt: null
  };
  const created = clients[clientId];
  // Creada un domingo: nunca arranca en domingo. Semanal: el día de cobro elegido (y su color);
  // las demás: la fecha del sábado anterior o del lunes siguiente.
  if (weekdayOf(today) === 0) {
    const payday = Number(values.paymentWeekday);
    const shifted = frequency === 'weekly'
      ? (payday >= 1 && payday <= 6 ? nextWeekdayDate(today, payday) : null)
      : values.paymentWeekday === 'prev' ? shiftDays(today, -1) : values.paymentWeekday === 'next' ? shiftDays(today, 1) : null;
    if (shifted) {
      created.creditStartDate = shifted;
      created.deliveredOn = today;
    }
  }
  if (source) {
    // Renovación: se heredan foto, notas, ubicaciones e historial; si la dirección cambió,
    // la anterior pasa al historial y la ubicación se vuelve a tomar.
    const changedAt = new Date().toISOString();
    const by = isAdmin ? 'Administrador' : state.activeWorker?.name || 'Trabajador';
    created.photoData = photoData || source.photoData || '';
    created.notes = source.notes || '';
    created.notesUpdatedAt = source.notesUpdatedAt || null;
    created.notesUpdatedBy = source.notesUpdatedBy || null;
    created.addressHistory = [...(source.addressHistory || [])];
    if (created.address === source.address) created.location = source.location || null;
    else created.addressHistory.push({ type: 'principal', address: source.address, replacedBy: created.address, location: source.location || null, changedAt, changedBy: by });
    if (created.altAddress === (source.altAddress || '')) created.altLocation = source.altLocation || null;
    else if (source.altAddress) created.addressHistory.push({ type: 'alternativa', address: source.altAddress, replacedBy: created.altAddress || '(eliminada)', location: source.altLocation || null, changedAt, changedBy: by });
    if (mode === 'renew') {
      created.renewedFrom = renewSourceId;
      created.renewalCount = (Number(source.renewalCount) || 0) + 1;
      source.renewedTo = clientId;
      source.renewedAt = today;
    }
    // Renovación: ocupa el lugar de la anterior. Otra cartulina: va después de la última
    // cartulina de la persona, para cobrarlas en la misma visita.
    const order = currentRouteOrder(assignedRoute).filter(id => id !== clientId);
    const siblings = personCardIds(clients, source.id).filter(id => id !== clientId && order.includes(id));
    const anchor = mode === 'extra' ? siblings.sort((a, b) => order.indexOf(a) - order.indexOf(b)).pop() || renewSourceId : renewSourceId;
    const index = order.indexOf(anchor);
    order.splice(index < 0 ? order.length : index + 1, 0, clientId);
    state.clientLibraryOrder[assignedRoute] = order;
  } else placeInRoute(assignedRoute, clientId);
  appendClientCards(clientId);
  if (source) personCardIds(clients, source.id).forEach(id => { if (id !== clientId) renderClientRows(id); });
  // El trabajador registra al cliente en su domicilio: esa posición (con su precisión y
  // fecha) va al mismo campo que usa el mapa. Sin ubicación, queda marcado para tomarla
  // después desde la ficha.
  if (gps && !hasCoordinates(created.location)) {
    if (gps.location) created.location = { ...gps.location, source: 'alta' };
    else {
      created.location = null;
      created.locationPending = true;
      created.locationFailure = gps.reason;
    }
  }
  const requests = [];
  if (!isAdmin && interestException) {
    requests.push({ type: 'interest', comment: values.interestComment.trim() });
  }
  requests.forEach(request => pendingRequests.push({
    id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...request, clientId, clientName: name, workerId: state.activeWorker.id, workerName: state.activeWorker.name,
    route: isAdmin ? route?.name : state.activeWorker.route, routeId: assignedRoute, createdAt: new Date().toISOString(), status: 'pending'
  }));
  if (route) {
    // El préstamo se resta una sola vez, en «Préstamos». Si el admin lo registra «sin afectar
    // la base del trabajador», ese dinero no salió de su efectivo: entra a la base y sale como préstamo.
    route.loans += principal;
    if (noBaseImpact) route.base += principal;
    route.loansNew.unshift({ name, clientId, amount: principal });
    route.loansEntered.unshift({ name, clientId, amount: total });
    // Los seguros se reciben en efectivo al entregar el préstamo: entran a la base del día.
    route.base += insurance.amount;
    route.monthlyInsurance = (Number(route.monthlyInsurance) || 0) + insurance.amount;
    if (routeSelect.value === assignedRoute) renderAdminRoute(assignedRoute);
    if (state.workerRoute === assignedRoute) renderRouteOperations(route);
  }
  persistBusinessData();
  renderPendingRequests();
  updateCashTotal();
  closeNewClientModal();
  const insuranceCopy = `Seguros ${formatMoney(insurance.amount)}${insurance.custom ? ' (valor especial)' : ''}.`;
  const lead = mode === 'renew' ? `Crédito renovado para ${name}.` : mode === 'extra' ? `Nueva cartulina creada para ${name}.` : isAdmin ? 'Cartulina creada para la ruta seleccionada.' : 'Cliente creado con el interés predeterminado del 20%.';
  const requestsCopy = requests.length ? ` ${requests.length} solicitud(es) enviada(s) a Pendientes.` : '';
  if (gps && !gps.location) {
    showToast(`Cartulina creada sin ubicación (${LOCATION_FAILURE_LABELS[gps.reason] || 'sin GPS'}). Tómala después desde la ficha del cliente.${requestsCopy}`);
  } else if (gps && isApproximateLocation(created.location)) {
    showToast(`${lead} Ubicación aproximada (± ${created.location.accuracy} m): revísala en el mapa.${requestsCopy}`);
  } else showToast(`${lead} ${insuranceCopy}${requestsCopy}`);
  return clientId;
}

/**
 * Sin datos móviles el GPS igual funciona, pero la primera ubicación puede tardar más que
 * los 10 s de espera. Si no alcanzó, se sigue intentando una vez más (hasta 45 s) mientras
 * el trabajador está en el domicilio; la cartulina ya quedó guardada y se envía al servidor
 * cuando vuelva la conexión, con la ubicación si llegó a tiempo.
 */
const RETRY_LOCATION_MS = 45000;
async function retryCreationLocation(clientId) {
  const startedAt = Date.now();
  const { location } = await locateDevice({ timeout: RETRY_LOCATION_MS });
  const client = clients[clientId];
  if (!location || !client || hasCoordinates(client.location)) return;
  client.location = { ...location, source: 'alta', capturedAfterSeconds: Math.round((Date.now() - startedAt) / 1000) + 10 };
  delete client.locationPending;
  delete client.locationFailure;
  persistBusinessData();
  document.dispatchEvent(new CustomEvent('edgecredit:client-location', { detail: { clientId } }));
  showToast(`Ubicación de ${client.name} guardada${isApproximateLocation(client.location) ? `, pero es aproximada (± ${client.location.accuracy} m)` : ` (± ${client.location.accuracy} m)`}.`);
}

// El detalle del cliente se registra aquí para abrir la cartulina nueva tras renovar
// (evita una importación circular new-client ↔ client-detail).
let onRenewed = null;
let creatingClient = false; // evita crear dos veces si pulsan «Crear» mientras se toma la ubicación
function onClientRenewed(callback) { onRenewed = callback; }

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_newClientModule() {
  document.querySelector('#route-position-search').addEventListener('input', renderPositionResults);
  document.querySelector('#route-position-results').addEventListener('click', event => {
    const option = event.target.closest('[data-position-client]');
    if (option) selectPosition(option.dataset.positionClient);
  });
  document.querySelector('#route-position-clear').addEventListener('click', () => { selectPosition(null); document.querySelector('#route-position-search').focus(); });
  document.querySelector('#toggle-alt-address').addEventListener('click', () => setAltAddressOpen(document.querySelector('#toggle-alt-address').getAttribute('aria-expanded') !== 'true'));
  document.querySelector('#admin-add-client').addEventListener('click', openNewClientModal);
  document.querySelector('#add-client').addEventListener('click', openNewClientModal);
  document.querySelector('#renew-client').addEventListener('click', () => openRenewalModal(state.activeClient));
  document.querySelector('#extra-card-client').addEventListener('click', () => openExtraCardModal(state.activeClient));
  document.querySelector('#client-photo-input').addEventListener('change', event => {
    const preview = document.querySelector('#client-photo-preview');
    const file = event.target.files?.[0];
    document.querySelector('#client-photo-file-name').textContent = file?.name || 'Ningún archivo seleccionado';
    if (!file) { preview.hidden = true; preview.removeAttribute('src'); return; }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
  document.querySelector('#new-client-close').addEventListener('click', closeNewClientModal);
  document.querySelector('#new-client-cancel').addEventListener('click', closeNewClientModal);
  document.querySelector('#interest-exception-toggle').addEventListener('change', event => {
    const fields = document.querySelector('#interest-exception-fields');
    fields.hidden = !event.target.checked;
    document.querySelector('#interest-exception-comment').required = event.target.checked && state.userRole === 'worker';
    document.querySelector('#interest-exception-value').required = event.target.checked && state.userRole === 'admin';
  });
  document.querySelector('#insurance-custom-toggle').addEventListener('change', event => setInsuranceCustom(event.target.checked));
  newClientForm.elements.principal.addEventListener('input', updateInsurancePreview);
  newClientForm.elements.frequency.addEventListener('change', updateSundayPayday);
  newClientModal.addEventListener('click', event => { if (event.target === newClientModal) closeNewClientModal(); });
  newClientForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!newClientForm.reportValidity()) return;
    const values = Object.fromEntries(new FormData(newClientForm).entries());
    const linked = Boolean(renewSourceId && clients[renewSourceId] && linkMode);
    if (!linked && Object.values(clients).some(client => personKey(client.id) === personKey(values.idNumber))) {
      newClientError.textContent = 'Esa cédula ya está registrada. Para darle otro crédito, abre su ficha y usa «＋ Otra cartulina» (o «Renovar» si ya canceló).';
      return;
    }
    const interestException = document.querySelector('#interest-exception-toggle').checked;
    if (state.userRole === 'admin' && (!Number.isFinite(Number(values.adminInterestPercent)) || Number(values.adminInterestPercent) < 0 || Number(values.adminInterestPercent) > 100)) {
      newClientError.textContent = 'El porcentaje acordado debe estar entre 0 y 100.';
      return;
    }
    const insurance = resolveInsurance(values.principal, document.querySelector('#insurance-custom-toggle').checked, values.insuranceAmount, values.insuranceReason);
    if (insurance.error) {
      newClientError.textContent = insurance.error;
      return;
    }
    if (creatingClient) return;
    creatingClient = true;
    const submit = document.querySelector('#new-client-submit');
    const submitLabel = submit.innerHTML;
    try {
      const photoData = await compressClientPhoto(document.querySelector('#client-photo-input').files?.[0]);
      const sourceId = renewSourceId;
      // GPS solo del trabajador (está en el domicilio). Una renovación con la misma dirección
      // conserva la ubicación que ya tenía.
      const source = linked ? clients[renewSourceId] : null;
      const keepsLocation = source && values.address.trim() === (source.address || '') && hasCoordinates(source.location);
      let gps = null;
      if (state.userRole === 'worker' && !keepsLocation) {
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        submit.textContent = 'Tomando ubicación…';
        gps = await locateDevice({ timeout: 10000 });
        if (newClientModal.hidden) return; // lo cancelaron mientras se tomaba la ubicación
      }
      const createdId = addNewClient(values, photoData, insurance, gps);
      if (sourceId && createdId && state.activeClient === sourceId) onRenewed?.(createdId);
      if (createdId && gps && !gps.location && (gps.reason === 'timeout' || gps.reason === 'unavailable')) retryCreationLocation(createdId);
    } catch (error) { newClientError.textContent = error.message || 'No se pudo procesar la foto.'; }
    finally {
      creatingClient = false;
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.innerHTML = submitLabel;
    }
  });
}

// ── js/features/daily-route/daily-route.js
/**
 * features/daily-route · Constructor de la ruta diaria: biblioteca (solo cartulinas activas),
 * orden de visitas e indicadores del día. Las visitas se cierran solas al registrar un abono
 * o "No pagó hoy" desde el Inicio; aquí solo se ven los indicadores y se pide revisión.
 */













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
function routePlanDate(route = state.workerRoute, now = new Date()) {
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
function todayRouteOrder(route = state.workerRoute) {
  const order = storedRouteOrder(route);
  if (!order.length) return order;
  const builtTs = routeBuiltTs(route);
  return order.filter(id => !paidSinceBuilt(clients[id], builtTs));
}

/** ¿Hay una ruta armada y sin cerrar (aunque ya se hayan cobrado todos sus clientes)? */
function hasBuiltRoute(route = state.workerRoute) {
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
function routeReadyMessage(route = state.workerRoute) {
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

function routeDayKey(route = state.workerRoute) {
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
function paymentCorrectionPending(clientId, payment) {
  return pendingRequests.some(request => request.status === 'pending' && request.type === 'route-correction' && request.clientId === clientId
    && (payment.at ? request.paymentAt === payment.at : request.visitDate === payment.date));
}

/**
 * Corrección de un abono puntual (desde «Abonos del día»): el trabajador indica el monto
 * correcto y el motivo; el admin lo aprueba en Solicitudes y se corrige ese abono.
 */
function requestPaymentCorrection(clientId, payment, onSent = () => {}) {
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
function paidTodayAmount(client) {
  const today = localDateISO();
  return (client?.payments || []).filter(payment => payment.date === today).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

/** Estado de la visita de hoy: 'paid' (abonó hoy), 'no-payment' (no pagó) o 'pending'. */
function visitStatus(clientId) {
  const client = clients[clientId];
  if (paidTodayAmount(client) > 0) return 'paid';
  return state.routeVisitOutcomes[routeDayKey()]?.[clientId] === 'no-payment' ? 'no-payment' : 'pending';
}

/** Cierra la visita de hoy: el cliente sale de la lista del Inicio pero sigue en la ruta diaria. */
function closeVisit(clientId, outcome, route = state.workerRoute) {
  const key = routeDayKey(route);
  state.collectedRouteClients[key] ||= [];
  if (!state.collectedRouteClients[key].includes(clientId)) state.collectedRouteClients[key].push(clientId);
  state.routeVisitOutcomes[key] ||= {};
  if (outcome) state.routeVisitOutcomes[key][clientId] = outcome;
}

/** Registra "No pagó hoy" y cierra la visita. */
function markNoPayment(clientId) {
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

function renderRouteBuilder() {
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
function __mount_dailyRouteModule() {
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

// ── js/features/operations/operations-list.js
/**
 * features/operations · Listados operativos (canceladas, préstamos ingresados/nuevos) con búsqueda.
 */









// Rango de fechas para el listado 'range-cancelled' (p. ej. tarjetas canceladas de una semana).
let activeRange = null;

function operationRoute() {
  return state.userRole === 'admin' ? routeSelect.value : state.workerRoute;
}

/** Día en que se entregó la plata de la cartulina (si se creó un domingo, ese domingo). */
function deliveryDate(client) {
  return client.deliveredOn || client.insuranceCollectedAt || client.creditStartDate || '';
}

/** Cartulinas canceladas (saldo en cero) de la ruta entre `from` y `to`, la más reciente primero. */
function cancelledCards(routeId, from, to) {
  return Object.entries(clients)
    .filter(([, client]) => client?.route === routeId && Number(client.balance) <= 0 && client.settledAt && client.settledAt >= from && client.settledAt <= to)
    .map(([clientId, client]) => ({ clientId, name: client.name, amount: Number(client.total) || 0, date: client.settledAt }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/**
 * Préstamos entregados en la ruta en `date`: cartulinas nuevas (alta, renovación u otra
 * cartulina) y retanqueos. Es «nuevo» solo si la persona nunca antes había tenido una
 * cartulina en el sistema; los demás son de clientes que ya habían estado.
 */
function loansOn(routeId, date) {
  const all = Object.entries(clients).filter(([, client]) => client);
  const loans = [];
  all.forEach(([clientId, client]) => {
    if (client.route !== routeId || client.importedFrom?.cancelledCard) return;
    if (deliveryDate(client) === date) {
      const key = personKey(client.id);
      const before = all.some(([otherId, other]) => otherId !== clientId && personKey(other.id) === key
        && (deliveryDate(other) < date || (deliveryDate(other) === date && otherId < clientId)));
      const isNew = !before && !client.renewedFrom;
      loans.push({ clientId, name: client.name, principal: Number(client.principal) || 0, amount: Number(client.total) || 0, isNew, kind: isNew ? 'Cliente nuevo' : client.renewedFrom ? 'Renovación' : 'Cliente que ya había estado' });
    }
    (client.restructures || []).filter(entry => entry.type === 'retanqueo' && entry.date === date).forEach(entry => {
      loans.push({ clientId, name: client.name, principal: Number(entry.extra) || 0, amount: (Number(entry.extra) || 0) + (Number(entry.interest) || 0), isNew: false, kind: 'Retanqueo' });
    });
  });
  return loans.sort((a, b) => a.name.localeCompare(b.name));
}

function renderOperationsModal() {
  const routeId = operationRoute();
  const route = routeSettlements[routeId];
  if (!route) return;
  const today = localDateISO();
  const yesterday = shiftDateISO(today, -1);
  const list = state.activeOperationList;
  const isCancelledList = ['cancelled', 'yesterday-cancelled', 'range-cancelled'].includes(list);
  // Canceladas: las de hoy; «Canceladas ayer»: las del día anterior. Préstamos nuevos: solo personas
  // que entran por primera vez; ingresados: todos los préstamos del día (nuevos y de clientes que ya habían estado).
  const entries = list === 'cancelled' ? cancelledCards(routeId, today, today)
    : list === 'yesterday-cancelled' ? cancelledCards(routeId, yesterday, yesterday)
      : list === 'range-cancelled' && activeRange ? cancelledCards(routeId, activeRange.from, activeRange.to)
        : list === 'new' ? loansOn(routeId, today).filter(loan => loan.isNew).map(loan => ({ ...loan, amount: loan.principal }))
          : loansOn(routeId, today);
  const term = normalizeSearch(operationsSearch.value.trim());
  const filtered = entries.filter(entry => {
    const client = clients[entry.clientId];
    return normalizeSearch(`${entry.name} ${client?.id || ''}`).includes(term);
  });
  document.querySelector('#operations-list-route').textContent = `RUTA ${route.name.toLocaleUpperCase('es')}`;
  document.querySelector('#operations-list-title').textContent = state.activeOperationList === 'range-cancelled' && activeRange ? `Tarjetas canceladas · ${activeRange.label}` : state.activeOperationList === 'yesterday-cancelled' ? `Tarjetas canceladas · ${formatDate(yesterday)}` : state.activeOperationList === 'cancelled' ? `Tarjetas canceladas · hoy ${formatDate(today)}` : state.activeOperationList === 'new' ? `Préstamos nuevos · hoy ${formatDate(today)}` : `Préstamos ingresados · hoy ${formatDate(today)}`;
  document.querySelector('#operations-results-count').textContent = `${filtered.length} de ${entries.length} registros`;
  operationsResults.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'operations-empty';
    empty.textContent = entries.length ? 'No hay resultados para esa búsqueda.' : state.activeOperationList === 'range-cancelled' ? 'No hubo tarjetas canceladas en esa semana en esta ruta.' : state.activeOperationList === 'yesterday-cancelled' ? 'No hay tarjetas canceladas el día anterior en esta ruta.' : state.activeOperationList === 'cancelled' ? 'Hoy no se han cancelado tarjetas en esta ruta.' : state.activeOperationList === 'new' ? 'Hoy no hay préstamos a clientes nuevos en esta ruta.' : 'Hoy no se han entregado préstamos en esta ruta.';
    operationsResults.append(empty);
    return;
  }
  filtered.forEach((entry, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'operations-result-row';
    row.dataset.opsClient = entry.clientId || '';
    row.dataset.opsIndex = String(index);
    const customer = document.createElement('span');
    customer.className = 'operations-result-customer';
    const name = document.createElement('strong');
    name.textContent = entry.name;
    const id = document.createElement('small');
    id.textContent = `${clients[entry.clientId]?.id ? `Cédula ${clients[entry.clientId].id}` : 'Cliente'}${isCancelledList && entry.date ? ` · cancelada el ${formatDate(entry.date)}` : ''}${!isCancelledList && entry.kind ? ` · ${entry.kind}` : ''}`;
    customer.append(name, id);
    const amount = document.createElement('strong');
    amount.className = 'operations-result-amount';
    amount.textContent = formatMoney(entry.amount);
    row.append(customer, amount, Object.assign(document.createElement('span'), { className: 'row-chevron', textContent: '›', ariaHidden: true }));
    operationsResults.append(row);
  });
}

/** Abre un listado. Para 'range-cancelled' recibe { from, to, label } (fechas ISO, inclusivas). */
function openOperationsList(type, range = null) {
  state.activeOperationList = ['cancelled', 'new', 'yesterday-cancelled', 'range-cancelled'].includes(type) ? type : 'entered';
  activeRange = type === 'range-cancelled' ? range : null;
  operationsSearch.value = '';
  renderOperationsModal();
  operationsModal.hidden = false;
  document.body.classList.add('modal-open');
  operationsSearch.focus();
}

function closeOperationsList() {
  operationsModal.hidden = true;
  if (customModal.hidden && modal.hidden && newClientModal.hidden && interestModal.hidden) document.body.classList.remove('modal-open');
}

function openOperationsClient(clientId) {
  if (!clients[clientId]) return;
  if (state.userRole === 'admin' && !adminView.hidden) {
    routeSelect.value = clients[clientId].route;
    renderAdminRoute(routeSelect.value);
    enterAdminDirectory();
  }
  openClient(clientId);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_operationsListModule() {
  document.querySelectorAll('[data-operation-list]').forEach(button => button.addEventListener('click', () => openOperationsList(button.dataset.operationList)));
  operationsSearch.addEventListener('input', renderOperationsModal);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !operationsModal.hidden) closeOperationsList(); });
  operationsModal.addEventListener('click', event => {
    if (event.target === operationsModal || event.target.closest('[data-close-operations-list]')) closeOperationsList();
    const row = event.target.closest('.operations-result-row[data-ops-client]');
    if (row?.dataset.opsClient && clients[row.dataset.opsClient]) {
      closeOperationsList();
      openOperationsClient(row.dataset.opsClient);
    }
  });
}

// ── js/features/payments/payment.js
/**
 * features/payments · Modal de registro de abonos (efectivo / transferencia con comprobante).
 */
















/** Comprobante elegido: captura de la galería («Subir captura») o foto («Tomar foto»). */
function chosenVoucher() {
  return voucherFile.files?.[0] || document.querySelector('#voucher-camera').files?.[0] || null;
}

function openPayment() {
  if (state.currentView !== 'detalle-cliente') return;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  amountInput.value = '';
  voucherFile.value = '';
  document.querySelector('#voucher-camera').value = '';
  document.querySelector('#voucher-file-name').textContent = 'Ningún archivo seleccionado';
  document.querySelector('input[name="method"][value="cash"]').checked = true;
  updatePaymentMethod();
  window.setTimeout(() => amountInput.focus(), 40);
}

function closePayment() {
  modal.hidden = true;
  if (customModal.hidden && newClientModal.hidden && interestModal.hidden) document.body.classList.remove('modal-open');
}

function updatePaymentMethod() {
  const isTransfer = document.querySelector('input[name="method"]:checked')?.value === 'transfer';
  voucherField.hidden = !isTransfer;
  voucherFile.required = false;
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_paymentModule() {
  document.querySelectorAll('[data-open-payment]').forEach(button => button.addEventListener('click', openPayment));
  document.querySelectorAll('[data-close-payment]').forEach(button => button.addEventListener('click', closePayment));
  document.querySelectorAll('input[name="method"]').forEach(input => input.addEventListener('change', updatePaymentMethod));
  modal.addEventListener('click', event => { if (event.target === modal) closePayment(); });
  paymentForm.addEventListener('submit', async event => {
    event.preventDefault();
    const returnHome = state.paymentFromHome; // openClient() lo reinicia más abajo
    if (!paymentForm.reportValidity()) return;
    const paymentMethod = document.querySelector('input[name="method"]:checked')?.value;
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      amountInput.setCustomValidity('Ingresa un monto mayor que cero.');
      amountInput.reportValidity();
      amountInput.addEventListener('input', () => amountInput.setCustomValidity(''), { once: true });
      return;
    }
    const client = clients[state.activeClient];
    if (amount > Number(client.balance)) {
      amountInput.setCustomValidity('El abono no puede superar el saldo pendiente.');
      amountInput.reportValidity();
      amountInput.addEventListener('input', () => amountInput.setCustomValidity(''), { once: true });
      return;
    }
    const paidDate = localDateISO();
    const cycleIndex = paymentCycleIndex(client, paidDate);
    let receiptData = '';
    try { receiptData = paymentMethod === 'transfer' ? await compressClientPhoto(chosenVoucher()) : ''; }
    catch (error) { showToast(error.message || 'No se pudo procesar el comprobante.'); return; }
    client.payments.unshift({
      date: paidDate,
      at: new Date().toISOString(),
      amount,
      method: paymentMethod,
      cycleIndex,
      receiptName: paymentMethod === 'transfer' ? chosenVoucher()?.name || '' : '',
      receiptData
    });
    const payment = client.payments[0];
    const paidClientId = state.activeClient;
    client.archivedPaymentsAt = null;
    client.balance = Math.max(0, Number(client.balance) - amount);
    updatePaidAmountTotal(client);
    client.settledAt = Number(client.balance) <= 0 ? client.settledAt || paidDate : null;
    const periodPaid = Number(client.balance) <= 0 || paymentAmountForCycle(client, cycleIndex) > 0;
    client.paidPeriodIndexes ||= [];
    if (periodPaid && !client.paidPeriodIndexes.includes(cycleIndex)) {
      client.paidPeriodIndexes.push(cycleIndex);
      client.paid = Math.min(Number(client.installments), Number(client.paid || 0) + 1);
      client.progress = client.installments ? Math.round(client.paid / client.installments * 100) : 0;
    }
    if (periodPaid) {
      const todayKey = routeDayKey(client.route);
      state.routeVisitOutcomes[todayKey] ||= {};
      state.routeVisitOutcomes[todayKey][state.activeClient] = 'paid';
      client.visitHistory ||= [];
      client.visitHistory = client.visitHistory.filter(item => item.date !== paidDate);
      client.visitHistory.push({ date: paidDate, outcome: 'paid' });
    } else if (state.routeVisitOutcomes[routeDayKey(client.route)]?.[state.activeClient] === 'no-payment') {
      state.routeVisitOutcomes[routeDayKey(client.route)][state.activeClient] = 'partial';
      client.visitHistory = (client.visitHistory || []).filter(item => item.date !== paidDate);
      client.visitHistory.push({ date: paidDate, outcome: 'partial' });
    }
    const paymentRisk = paymentBehavior(client);
    // Con la calificación por puntos la demora la mide el calendario (domain/loan-schedule).
    if (!ratingSystemActive()) client.paymentWarning ||= paymentRisk.overdueDays > 0 || paymentRisk.explicitlyMissed || paymentRisk.latePaid;
    const route = routeSettlements[client.route];
    if (route) route.collections += amount;
    // Cualquier abono de hoy cierra la visita: el cliente sale del Inicio y queda con
    // el indicador "Abono registrado" en la ruta diaria.
    closeVisit(state.activeClient, 'paid', client.route);
    if (Number(client.balance) <= 0) {
      client.paid = Number(client.installments) || client.paid;
      addCancelledCard(client, state.activeClient, paidDate);
      const todayKey = routeDayKey(client.route);
      state.routeVisitOutcomes[todayKey] ||= {};
      state.routeVisitOutcomes[todayKey][state.activeClient] = 'paid';
      client.visitHistory ||= [];
      client.visitHistory = client.visitHistory.filter(item => item.date !== paidDate);
      client.visitHistory.push({ date: paidDate, outcome: 'paid' });
    }
    const missingTransferEvidence = paymentMethod === 'transfer' && !chosenVoucher();
    updateCashTotal(); // caja del día (efectivo/bancos) y resumen del día
    persistBusinessData();
    closePayment();
    renderHistory(client);
    renderRouteBuilder();
    filterClientCards();
    renderClientRows(state.activeClient);
    const backView = state.previousView;
    openClient(state.activeClient);
    state.previousView = backView;
    if (returnHome) showView('inicio');
    showToast(missingTransferEvidence ? `Abono de ${formatMoney(amount)} registrado para ${client.name}. Falta adjuntar la evidencia.` : `Abono de ${formatMoney(amount)} registrado para ${client.name}.`);
  });
  const voucherCamera = document.querySelector('#voucher-camera');
  // Las dos formas son excluyentes: la última que se usó es el comprobante.
  voucherCamera.addEventListener('change', () => {
    if (voucherCamera.files?.length) voucherFile.value = '';
    document.querySelector('#voucher-file-name').textContent = voucherCamera.files?.[0] ? `Foto tomada: ${voucherCamera.files[0].name}` : 'Ningún archivo seleccionado';
  });
  voucherFile.addEventListener('change', () => {
    if (voucherFile.files?.length) voucherCamera.value = '';
    document.querySelector('#voucher-file-name').textContent = voucherFile.files?.[0]?.name || 'Ningún archivo seleccionado';
  });
}

// ── js/features/worker/cash-box.js
/**
 * features/worker/cash-box · Caja del trabajador (efectivo/bancos) y métricas del día.
 */











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

function updateCashTotal() {
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

function renderWorkerDailyMetrics() {
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

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_cashBoxModule() {
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

// ── js/features/worker/expenses.js
/**
 * features/worker/expenses · Menú (modal) de registro de "otros gastos", abierto desde
 * la tarjeta "Otros gastos" del Resumen del día, con foto de comprobante (opcional:
 * si falta, el gasto queda marcado "Sin comprobante" en la auditoría del admin).
 */










const expenseModal = () => document.querySelector('#worker-expense-modal');

function resetExpenseForm() {
  const form = document.querySelector('#worker-expense-form');
  form.reset();
  document.querySelector('#worker-expense-preview').hidden = true;
  document.querySelector('#worker-expense-preview').removeAttribute('src');
  document.querySelector('#worker-expense-file-name').textContent = 'Ningún archivo seleccionado';
  document.querySelector('#worker-expense-error').textContent = '';
}

/** Abre el menú de "otro gasto" (monto, descripción y foto de evidencia). */
function openExpenseModal() {
  if (state.userRole !== 'worker') return;
  resetExpenseForm();
  const modal = expenseModal();
  modal.hidden = false;
  modal.classList.add('active');
  document.body.classList.add('modal-open');
  window.setTimeout(() => document.querySelector('#worker-expense-amount').focus(), 30);
}

function closeExpenseModal() {
  const modal = expenseModal();
  if (modal.hidden) return;
  modal.hidden = true;
  modal.classList.remove('active');
  resetExpenseForm();
  if (!document.querySelector('.custom-modal-backdrop:not([hidden]), .modal-backdrop:not([hidden]), .ops-list-modal-backdrop:not([hidden])')) document.body.classList.remove('modal-open');
  document.querySelector('#open-worker-expense')?.focus();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_expensesModule() {
  document.querySelector('#worker-expense-receipt').addEventListener('change', event => {
    const preview = document.querySelector('#worker-expense-preview');
    const file = event.target.files?.[0];
    document.querySelector('#worker-expense-file-name').textContent = file?.name || 'Ningún archivo seleccionado';
    if (!file) { preview.hidden = true; preview.removeAttribute('src'); return; }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
  document.querySelector('#worker-expense-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = document.querySelector('#worker-expense-error');
    error.textContent = '';
    if (state.userRole !== 'worker' || !form.reportValidity()) return;
    const amount = Math.round(Number(form.elements.amount.value));
    const file = form.elements.receipt.files?.[0];
    const route = routeSettlements[state.workerRoute];
    if (!route || !Number.isFinite(amount) || amount <= 0) {
      error.textContent = 'Ingresa un monto válido.';
      return;
    }
    try {
      const receiptData = file ? await compressClientPhoto(file, { maxDimension: 1200, quality: 0.78 }) : '';
      route.otherExpenses = Math.max(0, Number(route.otherExpenses) || 0) + amount;
      route.otherExpenseEntries ||= [];
      route.otherExpenseEntries.unshift({ id: `expense-${Date.now()}`, amount, note: form.elements.note.value.trim(), date: localDateISO(), createdAt: new Date().toISOString(), workerId: state.activeWorker.id, workerName: state.activeWorker.name, receiptName: file?.name || '', receiptData });
      persistBusinessData();
      updateCashTotal();
      if (routeSelect.value === state.workerRoute) renderAdminRoute(state.workerRoute);
      closeExpenseModal();
      showToast(file ? `Gasto de ${formatMoney(amount)} registrado con comprobante.` : `Gasto de ${formatMoney(amount)} registrado SIN comprobante: quedará marcado para el administrador.`);
    } catch (uploadError) {
      error.textContent = uploadError.message || 'No se pudo procesar la foto del comprobante.';
    }
  });
  document.querySelector('#open-worker-expense').addEventListener('click', openExpenseModal);
  document.querySelector('#cancel-worker-expense').addEventListener('click', closeExpenseModal);
  document.querySelector('#close-worker-expense').addEventListener('click', closeExpenseModal);
  expenseModal().addEventListener('click', event => { if (event.target === expenseModal()) closeExpenseModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeExpenseModal(); });
}

// ── js/features/worker/home.js
/**
 * features/worker/home · Inicio del trabajador: primero los clientes de la ruta del día;
 * "Tu base hoy" y "Resumen del día" quedan plegados detrás de dos botones.
 */








const PANELS = [['#toggle-home-cash', '#home-cash-panel'], ['#toggle-home-metrics', '#home-metrics-panel']];

function setPanel(toggleSelector, panelSelector, open) {
  const toggle = document.querySelector(toggleSelector);
  const panel = document.querySelector(panelSelector);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.classList.toggle('is-open', open);
  panel.hidden = !open;
}

/** Cierra los paneles (al iniciar sesión cada jornada empieza con la vista de clientes). */
function collapseHomePanels() {
  PANELS.forEach(([toggle, panel]) => setPanel(toggle, panel, false));
}

/** Rótulo de la lista y aviso cuando la ruta del día aún no se ha organizado. */
function renderHomeHeader() {
  const route = routeSettlements[state.workerRoute];
  const weekday = new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(new Date());
  document.querySelector('#home-list-eyebrow').textContent = `${weekday} · RUTA ${route?.name || ''}`.toLocaleUpperCase('es');
  const organized = hasBuiltRoute();
  const hint = document.querySelector('#home-route-hint');
  hint.hidden = organized || state.userRole !== 'worker';
  hint.textContent = `${routeReadyMessage() || 'Aún no se ha armado la ruta del día.'} Ármala en «Ruta diaria» y aquí aparecerán los clientes que vas a visitar.`;
}

/** Muestra el total en caja dentro del botón "Tu base hoy" sin tener que abrirlo. */
function updateCashChip(totalText) {
  const chip = document.querySelector('#home-cash-total-chip');
  if (chip) chip.textContent = `${totalText} en caja`;
}

/**
 * Botones de cobro en cada cliente del Inicio ("Registrar cuota" y "No pagó hoy").
 * Al usarlos, la visita se cierra y el cliente sale de esta lista.
 */
function renderHomeRowActions() {
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

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_homeModule() {
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

// ── js/features/worker/location.js
/**
 * features/worker/location · GPS: envío desde el dispositivo del trabajador y consulta desde admin.
 */







/** Última ubicación enviada por el trabajador (llega por la sincronización con el servidor). */
function fetchWorkerLocation(worker) {
  const location = shared.workerLocations[worker.id];
  if (location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))) {
    showWorkerLocation(worker, location, 'GPS compartido desde el celular del trabajador');
    return;
  }
  showToast(`No hay una ubicación GPS reciente de ${worker.name}. Activa “Compartir GPS” desde su dispositivo.`);
}

function showWorkerLocation(worker, location, source) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const updatedAt = location.updated_at || location.timestamp;
  const reportedAt = updatedAt ? new Date(updatedAt).toLocaleString('es-CO') : 'hora no reportada';
  const ageMs = updatedAt ? Date.now() - new Date(updatedAt).getTime() : 0;
  const staleNote = ageMs > 10 * 60 * 1000 ? ' La ubicación tiene más de 10 minutos y puede estar desactualizada.' : '';
  openCustomModal({
    title: `Ubicación de ${worker.name}`,
    description: `Fuente: ${source}. Último GPS: ${reportedAt}. Coordenadas: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}.${staleNote}`,
    submitLabel: 'Abrir mapa',
    onSubmit: () => window.open(mapUrl, '_blank', 'noopener,noreferrer')
  });
}

// Celular de la empresa: el GPS está SIEMPRE activo mientras el trabajador usa la app; no
// se puede apagar. En la barra hay solo un testigo del estado (no es un botón: no se toca).
// Cada posición actualiza la «última ubicación» y, cada cierto movimiento, agrega un punto
// al recorrido del día (core/tracks.js) que el admin ve en el mapa.
const TRACK_MIN_SECONDS = 20;        // como máximo un punto cada 20 s…
const TRACK_MIN_METERS = 15;         // …si se movió al menos 15 m
const TRACK_IDLE_SECONDS = 120;      // quieto: un punto cada 2 min (para saber que sigue ahí)
const TRACK_MAX_ACCURACY = 100;      // posiciones peores que 100 m no entran al recorrido
let lastTrackPoint = null;

const GPS_STATUS = {
  active: { label: 'GPS activo', detail: 'Tu ubicación se está enviando al administrador.' },
  searching: { label: 'Buscando GPS…', detail: 'El celular está buscando señal de GPS. Sal a cielo abierto si tarda; se envía sola apenas la encuentre.' },
  denied: { label: 'GPS sin permiso', detail: 'El permiso de ubicación está bloqueado. Toca el candado junto a la dirección de la página → Permisos → Ubicación → Permitir, y recarga la página.' },
  unsupported: { label: 'Sin GPS', detail: 'Este navegador no da la ubicación. Usa Chrome en el celular de la empresa.' },
  off: { label: 'GPS', detail: '' },
};

let gpsMode = 'off';
let gpsPermission = 'unknown'; // permiso del navegador: granted, denied, prompt o unknown

function setGpsStatus(mode) {
  gpsMode = mode;
  renderGpsSetting();
  gpsIndicator.classList.toggle('is-active', mode === 'active');
  gpsIndicator.classList.toggle('is-searching', mode === 'searching');
  gpsIndicator.classList.toggle('is-denied', mode === 'denied' || mode === 'unsupported');
  const { label, detail } = GPS_STATUS[mode];
  gpsIndicator.querySelector('.gps-indicator-label').textContent = label;
  gpsIndicator.title = detail ? `${label}. ${detail}` : label; // en el celular solo se ve el ícono
  gpsIndicator.setAttribute('aria-label', `Estado del GPS: ${label}`);
}

function shouldRecord(point) {
  if (!(point.accuracy <= TRACK_MAX_ACCURACY)) return false;
  if (!lastTrackPoint) return true;
  const seconds = (new Date(point.recordedAt) - new Date(lastTrackPoint.recordedAt)) / 1000;
  if (seconds < TRACK_MIN_SECONDS) return false;
  return seconds >= TRACK_IDLE_SECONDS || trackDistance(lastTrackPoint, point) >= TRACK_MIN_METERS;
}

function startWatch() {
  if (!navigator.geolocation) { setGpsStatus('unsupported'); return; }
  if (state.locationWatchId !== null) return;
  setGpsStatus('searching');
  state.locationWatchId = navigator.geolocation.watchPosition(position => {
    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      updated_at: new Date(position.timestamp || Date.now()).toISOString()
    };
    setGpsStatus('active');
    const point = {
      latitude: location.latitude, longitude: location.longitude, accuracy: Math.round(location.accuracy),
      speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null, recordedAt: location.updated_at,
    };
    if (shouldRecord(point)) {
      lastTrackPoint = point;
      recordTrackPoint(state.activeWorker?.id, state.workerRoute, point);
    }
    // La última ubicación se guarda como máximo cada 15 s para no saturar la sincronización.
    if (Date.now() - state.lastLocationWrite > 15000) {
      state.lastLocationWrite = Date.now();
      shared.workerLocations[state.activeWorker.id] = location;
      persistBusinessData();
    }
  }, error => {
    if (error.code === error.PERMISSION_DENIED) {
      // Sin permiso no hay nada que vigilar; se avisa y se vuelve a intentar al regresar a la app.
      navigator.geolocation.clearWatch(state.locationWatchId);
      state.locationWatchId = null;
      setGpsStatus('denied');
      showToast('Activa el permiso de ubicación: el celular de la empresa debe compartir el GPS siempre.');
      return;
    }
    // Sin señal o tarda en responder: se sigue buscando.
    setGpsStatus('searching');
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}

/**
 * Ajustes → «Compartir ubicación (GPS)»: el botón queda activo mientras el celular no haya
 * dado el permiso de ubicación y se desactiva apenas lo acepta.
 */
function renderGpsSetting() {
  const button = document.querySelector('#gps-setting-button');
  const status = document.querySelector('#gps-setting-status');
  if (!button || !status) return;
  document.querySelector('#gps-setting').hidden = state.userRole !== 'worker';
  const accepted = gpsMode === 'active' || (gpsPermission === 'granted' && gpsMode !== 'denied' && gpsMode !== 'unsupported');
  button.disabled = accepted || gpsMode === 'unsupported';
  button.textContent = accepted ? 'Activada ✓' : gpsMode === 'denied' || gpsPermission === 'denied' ? 'Reintentar' : 'Activar';
  button.classList.toggle('is-accepted', accepted);
  if (gpsMode === 'unsupported') status.textContent = GPS_STATUS.unsupported.detail;
  else if (accepted) status.textContent = gpsMode === 'active' ? 'Ubicación compartida. El GPS está activo.' : 'Permiso aceptado. Buscando señal de GPS…';
  else if (gpsMode === 'denied' || gpsPermission === 'denied') status.textContent = GPS_STATUS.denied.detail;
  else status.textContent = 'Toca «Activar» y acepta compartir la ubicación cuando el celular lo pregunte.';
}

/** Sigue el permiso de ubicación del navegador (si lo permite) para mantener el botón al día. */
function watchGpsPermission() {
  if (!navigator.permissions?.query) { renderGpsSetting(); return; }
  navigator.permissions.query({ name: 'geolocation' }).then(permission => {
    gpsPermission = permission.state;
    renderGpsSetting();
    permission.addEventListener('change', () => {
      gpsPermission = permission.state;
      if (permission.state === 'granted' && state.userRole === 'worker') startWatch();
      renderGpsSetting();
    });
  }).catch(() => renderGpsSetting());
}

/** Al entrar el trabajador el GPS se activa solo (el permiso se pide una única vez). */
function resumeWorkerLocationSharing() {
  if (state.userRole !== 'worker') return;
  lastTrackPoint = null;
  startWatch();
  resumeTrackUpload(state.activeWorker?.id);
  renderGpsSetting();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_locationModule() {
  watchGpsPermission();
  document.querySelector('#gps-setting-button').addEventListener('click', () => {
    if (state.userRole !== 'worker') return;
    // Si quedó una búsqueda abierta, se reinicia para que el celular vuelva a pedir el permiso.
    if (state.locationWatchId !== null) { navigator.geolocation?.clearWatch(state.locationWatchId); state.locationWatchId = null; }
    startWatch();
  });
  // El celular pausa el GPS con la app en segundo plano: al volver se reanuda solo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || state.userRole !== 'worker' || gpsIndicator.hidden) return;
    startWatch();
    resumeTrackUpload(state.activeWorker?.id);
  });
  window.addEventListener('online', () => { if (state.userRole === 'worker') resumeTrackUpload(state.activeWorker?.id); });
}

// ── js/shared/crypto.js
/**
 * shared/crypto · Hash SHA-256 de credenciales (requiere contexto seguro: HTTPS o localhost).
 */

async function hashCredential(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador requiere HTTPS o localhost para proteger las credenciales.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// ── js/shared/dates.js
/**
 * shared/dates · Utilidades de fecha local (ISO yyyy-mm-dd). Funciones puras.
 */

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / 86400000);
}

function localDateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dayDifference(from, to) {
  return Math.floor((localDate(to) - localDate(from)) / 86400000);
}

function shiftDateISO(date, amount) {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + amount);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}

// ── js/shared/format.js
/**
 * shared/format · Formateo y normalización de texto, dinero y colores. Funciones puras.
 */

const formatMoney = value => '$ ' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);

const routeKey = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, '-');

const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function blendColor(from, to, amount) {
  const a = from.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16));
  const b = to.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16));
  return `#${a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

// ── js/shared/geo.js
/**
 * shared/geo · Captura de la posición GPS del dispositivo sin bloquear la operación.
 * Nunca rechaza: resuelve con { location, reason }. Si no hay ubicación, `reason` dice por
 * qué: 'denied' (permiso negado), 'unavailable' (sin señal), 'timeout' o 'unsupported'.
 */
function locateDevice({ timeout = 10000 } = {}) {
  if (!navigator.geolocation) return Promise.resolve({ location: null, reason: 'unsupported' });
  return new Promise(resolve => {
    let settled = false;
    const done = value => { if (!settled) { settled = true; resolve(value); } };
    // Algunos navegadores nunca responden si el usuario ignora el aviso de permiso.
    const guard = window.setTimeout(() => done({ location: null, reason: 'timeout' }), timeout + 500);
    navigator.geolocation.getCurrentPosition(position => {
      window.clearTimeout(guard);
      done({
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        },
        reason: null,
      });
    }, error => {
      window.clearTimeout(guard);
      done({ location: null, reason: error?.code === 1 ? 'denied' : error?.code === 3 ? 'timeout' : 'unavailable' });
    }, { enableHighAccuracy: true, timeout, maximumAge: 0 }); // posición nueva: se toma en el domicilio
  });
}

const LOCATION_FAILURE_LABELS = {
  denied: 'permiso de ubicación negado',
  unavailable: 'sin señal de GPS',
  timeout: 'se acabó el tiempo de espera',
  unsupported: 'este navegador no da la ubicación',
};

/** Precisión (en metros) a partir de la cual la ubicación se guarda pero se avisa que es aproximada. */
const APPROXIMATE_LOCATION_METERS = 100;

const isApproximateLocation = location => Number(location?.accuracy) > APPROXIMATE_LOCATION_METERS;

const hasCoordinates = location => Boolean(location) && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));

const GEOCODE_CACHE_KEY = 'edgecredit-geocode-cache';

/**
 * Busca un municipio de Colombia en OpenStreetMap (Nominatim) y devuelve su recuadro
 * { bbox: [sur, oeste, norte, este], center: [lat, lng], label } o null.
 * Resultados en caché por dispositivo para no repetir consultas (política de uso de Nominatim).
 */
async function geocodeMunicipality(city, departmentName = '') {
  const name = String(city || '').trim();
  if (!name) return null;
  const key = `${name}|${departmentName}`.toLocaleLowerCase('es');
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}'); } catch { /* caché opcional */ }
  if (cache[key]) return cache[key];
  const query = [name, departmentName.replace(' D.C.', ''), 'Colombia'].filter(Boolean).join(', ');
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'co', q: query });
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json', 'Accept-Language': 'es' }, signal: controller.signal });
    if (!response.ok) return null;
    const [place] = await response.json();
    if (!place?.boundingbox) return null;
    const [south, north, west, east] = place.boundingbox.map(Number);
    const result = { bbox: [south, west, north, east], center: [Number(place.lat), Number(place.lon)], label: name };
    cache[key] = result;
    try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch { /* caché opcional */ }
    return result;
  } catch { return null; } finally { window.clearTimeout(timer); }
}

// ── js/shared/math.js
/**
 * shared/math · Reparto de montos y reordenamiento de listas. Funciones puras.
 */

function distributeAmount(total, count, index) {
  const base = Math.floor(total / count);
  return base + (index < total % count ? 1 : 0);
}

function moveId(order, clientId, beforeId) {
  const next = order.filter(id => id !== clientId);
  const index = beforeId ? next.indexOf(beforeId) : -1;
  next.splice(index < 0 ? next.length : index, 0, clientId);
  return next;
}

// ── js/shared/media.js
/**
 * shared/media · Compresión de fotos (clientes y comprobantes) antes de guardarlas.
 */

function compressClientPhoto(file, { maxDimension = 480, quality = 0.76 } = {}) {
  if (!file) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la foto seleccionada.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// ── js/shared/totp.js
/**
 * shared/totp · Códigos de un solo uso basados en tiempo (TOTP, RFC 6238) para la
 * verificación en dos pasos. Compatible con Google Authenticator, Microsoft
 * Authenticator, Authy, etc. (HMAC-SHA1, 6 dígitos, periodo de 30 s).
 * Usa Web Crypto: requiere contexto seguro (HTTPS, localhost o archivo local).
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD = 30;
const DIGITS = 6;

function base32Encode(bytes) {
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { output += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const output = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Clave de autenticación inválida.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(output);
}

function requireSubtle() {
  if (!globalThis.crypto?.subtle) throw new Error('La verificación en dos pasos requiere HTTPS o localhost.');
  return crypto.subtle;
}

/** Clave secreta aleatoria de 160 bits en Base32. */
function generateTotpSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

/** Código para un paso de tiempo concreto (contador de 30 s). */
async function totpForStep(secret, step) {
  const subtle = requireSubtle();
  const key = await subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = new ArrayBuffer(8);
  const view = new DataView(counter);
  view.setUint32(0, Math.floor(step / 2 ** 32));
  view.setUint32(4, step >>> 0);
  const mac = new Uint8Array(await subtle.sign('HMAC', key, counter));
  const offset = mac[mac.length - 1] & 15;
  const binary = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / TOTP_PERIOD);
}

/**
 * Verifica un código aceptando ±1 periodo de desfase del reloj del teléfono.
 * Devuelve el paso que coincidió (para impedir reutilizar el mismo código) o null.
 */
async function verifyTotp(secret, code, { lastUsedStep = -1, now = Date.now() } = {}) {
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== DIGITS || !secret) return null;
  const step = currentStep(now);
  for (const candidate of [step, step - 1, step + 1]) {
    if (candidate <= lastUsedStep) continue;
    if (await totpForStep(secret, candidate) === clean) return candidate;
  }
  return null;
}

/** URI estándar para registrar la cuenta en la app (se codifica en el QR). */
function otpauthUri(secret, account, issuer = 'EdgeCredit') {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${TOTP_PERIOD}`;
}

/** Agrupa la clave en bloques de 4 para dictarla o copiarla a mano. */
function formatSecret(secret) {
  return String(secret).replace(/(.{4})/g, '$1 ').trim();
}

/** Códigos de respaldo de un solo uso (formato XXXX-XXXX). */
function generateRecoveryCodes(count = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: count }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const raw = [...bytes].map(byte => alphabet[byte % alphabet.length]).join('');
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

function normalizeRecoveryCode(code) {
  const raw = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : '';
}

// ── js/ui/back-navigation.js
/**
 * ui/back-navigation · Botón «atrás» del celular (y del navegador).
 *
 * Cada pantalla, panel del admin o ventana modal que se abre agrega una entrada al
 * historial (`history.pushState`); al pulsar atrás (`popstate`) se cierra la modal de
 * encima o se vuelve a la pantalla anterior. En la pantalla de inicio el primer atrás
 * avisa «Pulsa atrás otra vez para salir» y solo un segundo atrás dentro de 2 s cierra la app.
 *
 * No hace falta tocar cada módulo: se observa la interfaz (atributo `hidden` y clases) y el
 * historial se ajusta a lo que está abierto. Cerrar algo con su botón (×, Cancelar, Escape)
 * retira su entrada sin que se note.
 *
 * Historial de una sesión: [0 · centinela] [1 · inicio] [2…n · una capa por pantalla o modal].
 */








const EXIT_WINDOW_MS = 2000;

/** Ventanas que se cierran con atrás: cómo saber si están abiertas y con qué botón se cierran. */
const BACK_MODALS = [
  { key: 'admin-menu', isOpen: () => document.body.classList.contains('admin-menu-open'), close: '#admin-menu-close' },
  { key: 'payment', isOpen: () => !document.querySelector('#payment-modal')?.hidden, close: '[data-close-payment]' },
  { key: 'interest', isOpen: () => !document.querySelector('#interest-modal')?.hidden, close: '[data-close-interest]' },
  { key: 'new-client', isOpen: () => !document.querySelector('#new-client-modal')?.hidden, close: '#new-client-close' },
  { key: 'worker-expense', isOpen: () => !document.querySelector('#worker-expense-modal')?.hidden, close: '#close-worker-expense' },
  { key: 'operations-list', isOpen: () => !document.querySelector('#operations-list-modal')?.hidden, close: '[data-close-operations-list]' },
  { key: 'custom', isOpen: () => !document.querySelector('#custom-modal')?.hidden, close: '#custom-modal-close' },
  { key: 'image-viewer', isOpen: () => !document.querySelector('#image-viewer')?.hidden, close: '#image-viewer-close' },
];

const navSession = Math.random().toString(36).slice(2); // distingue las entradas de esta carga de la página
let navActive = false;
let navLayers = [];          // [{ type: 'screen', snap } | { type: 'modal', modal }]
let navEntry = 0;            // entrada del historial en la que estamos (0 centinela, 1 inicio…)
let navScreen = null;        // { key, snap } pantalla actual
let navSilent = 0;           // popstate propios por ignorar (retrocesos hechos por la app)
let navSilentTimer = null;
let navQueue = [];           // operaciones de historial en espera de un retroceso propio
let navRestoring = false;
let exitArmed = false;
let exitTimer = null;

// ── Pantalla actual ──

function currentScreen() {
  if (!loginGateway.hidden || (workerView.hidden && adminView.hidden)) return null;
  if (!adminView.hidden) return { mode: 'admin', panel: state.activeAdminPanel };
  const mode = document.body.classList.contains('admin-client-mode') ? 'admin-client' : 'worker';
  return { mode, view: state.currentView, client: state.currentView === 'detalle-cliente' ? state.activeClient : null };
}

// La ficha del cliente es una sola pantalla aunque se pase a la cartulina siguiente.
const screenKey = snap => `${snap.mode}:${snap.panel || snap.view}`;
const isHomeScreen = snap => (snap.mode === 'worker' && snap.view === 'inicio') || (snap.mode === 'admin' && snap.panel === defaultAdminPanel());

// Pantalla actual guardada en la pestaña: al recargar, la sesión restaurada vuelve aquí.
const LAST_SCREEN_KEY = 'edgecredit-last-screen';

function rememberScreen(snap) {
  try { sessionStorage.setItem(LAST_SCREEN_KEY, JSON.stringify(snap)); } catch { /* opcional */ }
}

/** Tras restaurar la sesión al recargar: vuelve a la pantalla en la que estaba (si es del mismo rol). */
function restoreLastScreen(isAdmin) {
  let snap = null;
  try { snap = JSON.parse(sessionStorage.getItem(LAST_SCREEN_KEY) || 'null'); } catch { /* opcional */ }
  if (!snap?.mode || (snap.mode === 'worker') === Boolean(isAdmin)) return;
  if (snap.mode === 'admin' && !document.querySelector(`[data-admin-panel="${snap.panel}"]`)) return;
  if (snap.mode !== 'admin' && (!document.getElementById(snap.view) || (snap.view === 'detalle-cliente' && !clients[snap.client]))) return;
  if (isHomeScreen(snap)) return;
  // Primero el historial arranca en el inicio; así «atrás» desde la pantalla restaurada vuelve allí.
  reconcile();
  try { restoreScreen(snap); } catch { /* si ya no existe, se queda en el inicio */ }
}

function restoreScreen(snap) {
  if (snap.mode === 'admin') {
    if (adminView.hidden) document.querySelector('#admin-directory-back')?.click();
    showAdminPanel(snap.panel);
    return;
  }
  if (snap.mode === 'admin-client' && !document.body.classList.contains('admin-client-mode')) enterAdminDirectory();
  if (snap.view === 'detalle-cliente' && snap.client) openClient(snap.client);
  else showView(snap.view);
}

// ── Historial ──

function runHistory(operation) {
  if (navSilent > 0) navQueue.push(operation);
  else operation();
}

function pushEntry(depth) {
  runHistory(() => history.pushState({ edgecredit: navSession, depth }, ''));
}

/** Retrocede n entradas sin tratarlo como un «atrás» de la persona. */
function goBackSilently(steps) {
  if (steps <= 0) return;
  runHistory(() => {
    navSilent += 1;
    window.clearTimeout(navSilentTimer);
    // Por si el navegador no avisa (no debería): no se queda esperando para siempre.
    navSilentTimer = window.setTimeout(() => { navSilent = 0; drainQueue(); }, 1000);
    history.go(-steps);
  });
}

function drainQueue() {
  const pending = navQueue;
  navQueue = [];
  pending.forEach(operation => runHistory(operation));
}

function disarmExit() {
  exitArmed = false;
  window.clearTimeout(exitTimer);
}

function start(snap) {
  navActive = true;
  navLayers = [];
  navScreen = { key: screenKey(snap), snap };
  runHistory(() => history.replaceState({ edgecredit: navSession, depth: 0 }, ''));
  pushEntry(1);
  navEntry = 1;
}

function stop() {
  disarmExit();
  goBackSilently(navEntry);
  navActive = false;
  navLayers = [];
  navEntry = 0;
  navScreen = null;
}

/** Ajusta las capas del historial a lo que está abierto en pantalla. */
function reconcile() {
  if (navRestoring) return;
  const snap = currentScreen();
  if (!snap) { if (navActive) stop(); return; }
  if (!navActive) { start(snap); rememberScreen(snap); return; }
  const before = navLayers.length;
  const added = [];
  // Modales cerradas con su botón, Escape o al guardar: se retira su entrada.
  navLayers = navLayers.filter(layer => layer.type !== 'modal' || layer.modal.isOpen());
  rememberScreen(snap);
  const key = screenKey(snap);
  if (key !== navScreen.key) {
    // Volver al inicio por el menú limpia el camino: el siguiente atrás ofrece salir.
    if (isHomeScreen(snap)) navLayers = navLayers.filter(layer => layer.type !== 'screen');
    else added.push({ type: 'screen', snap: navScreen.snap });
    navScreen = { key, snap };
  } else navScreen.snap = snap;
  BACK_MODALS.forEach(modal => {
    if (modal.isOpen() && !navLayers.some(layer => layer.modal === modal)) added.push({ type: 'modal', modal });
  });
  const removed = before - navLayers.length;
  if (!removed && !added.length) return;
  goBackSilently(removed);
  if (added.length && navEntry === 0) { disarmExit(); pushEntry(1); }
  added.forEach(layer => { navLayers.push(layer); pushEntry(navLayers.length + 1); });
  navEntry = navLayers.length + 1;
}

function closeLayer(layer) {
  if (layer.type === 'modal') document.querySelector(layer.modal.close)?.click();
  else restoreScreen(layer.snap);
}

/** Primer atrás en el inicio: avisa; si en 2 s no hay otro, se vuelve a dejar la entrada del inicio. */
function askToExit() {
  disarmExit();
  exitArmed = true;
  showToast('Pulsa atrás otra vez para salir');
  exitTimer = window.setTimeout(() => {
    exitArmed = false;
    if (navActive && navEntry === 0) { pushEntry(1); navEntry = 1; }
  }, EXIT_WINDOW_MS);
}

function onPopState(event) {
  if (navSilent > 0) {
    navSilent -= 1;
    if (!navSilent) { window.clearTimeout(navSilentTimer); drainQueue(); }
    return;
  }
  if (!navActive) return;
  const target = event.state?.edgecredit === navSession ? Number(event.state.depth) || 0 : -1;
  if (target < 0) {
    // Entrada de antes (p. ej. de una carga anterior de la página): la persona quiere salir.
    if (exitArmed) history.back();
    else { askToExit(); navEntry = 0; }
    return;
  }
  const current = navLayers.length + 1;
  if (target > current) { goBackSilently(target - current); return; } // «adelante»: se ignora
  navRestoring = true;
  try {
    while (navLayers.length + 1 > Math.max(target, 1)) closeLayer(navLayers.pop());
  } finally {
    navRestoring = false;
  }
  const snap = currentScreen();
  if (snap) navScreen = { key: screenKey(snap), snap };
  navEntry = target;
  if (target === 0) askToExit();
  // Si algo no se dejó cerrar (p. ej. pide confirmación), vuelve a tener su entrada.
  queueMicrotask(reconcile);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_backNavigationModule() {
  window.addEventListener('popstate', onPopState);
  new MutationObserver(reconcile).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
}

// ── js/ui/custom-modal.js
/**
 * ui/custom-modal · Modal genérico de formulario/confirmación reutilizado por todos los módulos.
 * Contrato: openCustomModal({ title, description, fields, submitLabel, onSubmit, cancelLabel, onCancel }).
 * cancelLabel/onCancel permiten usar el botón secundario como acción (p. ej. «No recordar más»);
 * si onCancel devuelve false, el modal sigue abierto.
 * onSubmit puede ser async; si devuelve false, el modal queda abierto.
 *
 * Además de los campos normales:
 *  - `type: 'note'`: recuadro informativo (`label`, `value`, `hint`, `className`), como el
 *    «Interés predeterminado» al crear un préstamo. `valueId`/`hintId` permiten cambiarlo en vivo.
 *  - `type: 'checkbox'`: casilla (p. ej. «Usar un interés diferente al general»).
 *  - `showWhen: '<nombre de casilla>'`: el campo solo se ve (y se envía) con esa casilla marcada.
 *  - `onInput(form)`: se llama al escribir o marcar algo (para actualizar las notas).
 */



function openCustomModal({ title, description = '', fields = [], submitLabel = 'Guardar', onSubmit, cancelLabel = 'Cancelar', onCancel = null, onInput = null }) {
  state.lastFocusedElement = document.activeElement;
  document.querySelector('#custom-modal-title').textContent = title;
  document.querySelector('#custom-modal-description').textContent = description;
  document.querySelector('#custom-modal-save').textContent = submitLabel;
  document.querySelector('#custom-modal-cancel').textContent = cancelLabel;
  state.customModalCancel = onCancel;
  customModalError.textContent = '';
  customModalFields.replaceChildren();
  state.customModalSubmit = onSubmit;
  fields.forEach((field, index) => {
    if (field.type === 'note') {
      const note = document.createElement('div');
      note.className = field.className || 'default-rate-note';
      const label = document.createElement('span');
      label.textContent = field.label;
      const value = document.createElement('strong');
      value.textContent = field.value ?? '';
      if (field.valueId) value.id = field.valueId;
      note.append(label, value);
      if (field.hint) {
        const hint = document.createElement('small');
        hint.textContent = field.hint;
        if (field.hintId) hint.id = field.hintId;
        note.append(hint);
      }
      if (field.showWhen) { note.dataset.showWhen = field.showWhen; note.hidden = true; }
      customModalFields.append(note);
      return;
    }
    if (field.type === 'checkbox') {
      const toggle = document.createElement('label');
      toggle.className = 'exception-toggle';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.id = `custom-field-${index}`;
      box.name = field.name;
      box.checked = Boolean(field.value);
      const text = document.createElement('span');
      text.textContent = field.label;
      toggle.append(box, text);
      customModalFields.append(toggle);
      return;
    }
    const wrapper = document.createElement('label');
    wrapper.className = 'custom-field';
    wrapper.htmlFor = `custom-field-${index}`;
    wrapper.append(document.createTextNode(field.label));
    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      field.options.forEach(option => {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        input.append(element);
      });
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = field.rows || 3;
      if (field.placeholder) input.placeholder = field.placeholder;
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
      if (field.minLength !== undefined) input.minLength = Number(field.minLength);
      if (field.placeholder) input.placeholder = field.placeholder;
    }
    // Campos de dinero ($): se muestran con separador de miles (ui/money-input.js).
    if (field.money || (field.type === 'number' && /\(\$\)/.test(field.label))) input.dataset.money = '';
    // `thousands: true`: el monto se escribe en miles (200 = $ 200.000), como los abonos.
    if (field.thousands) { input.dataset.money = ''; input.dataset.moneyThousands = ''; }
    input.id = `custom-field-${index}`;
    input.name = field.name;
    input.value = field.value ?? '';
    input.required = Boolean(field.required);
    wrapper.append(input);
    if (field.showWhen) { wrapper.dataset.showWhen = field.showWhen; wrapper.classList.add('custom-field-dependent'); }
    customModalFields.append(wrapper);
  });
  // Campos que dependen de una casilla: ocultos y deshabilitados (no se envían) hasta marcarla.
  const syncDependents = () => customModalFields.querySelectorAll('[data-show-when]').forEach(node => {
    const box = customModalFields.querySelector(`input[type="checkbox"][name="${node.dataset.showWhen}"]`);
    node.hidden = !box?.checked;
    node.querySelectorAll('input,select,textarea').forEach(control => { control.disabled = node.hidden; });
  });
  syncDependents();
  customModalFields.oninput = customModalFields.onchange = () => { syncDependents(); onInput?.(customModalForm); };
  onInput?.(customModalForm);
  customModal.hidden = false;
  customModal.classList.add('active');
  document.body.classList.add('modal-open');
  window.setTimeout(() => customModalFields.querySelector('input:not([type="checkbox"]),select')?.focus(), 20);
}

function closeCustomModal() {
  customModal.hidden = true;
  customModal.classList.remove('active');
  state.customModalSubmit = null;
  if (interestModal.hidden && modal.hidden && newClientModal.hidden) document.body.classList.remove('modal-open');
  if (state.lastFocusedElement instanceof HTMLElement) state.lastFocusedElement.focus();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_customModalModule() {
  customModalForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!customModalForm.reportValidity()) return;
    const values = Object.fromEntries(new FormData(customModalForm).entries());
    const saveButton = document.querySelector('#custom-modal-save');
    saveButton.disabled = true;
    try {
      const result = await state.customModalSubmit?.(values);
      if (result !== false) closeCustomModal();
    } catch (error) {
      customModalError.textContent = error.message || 'No se pudo completar la operación.';
    } finally {
      saveButton.disabled = false;
    }
  });
  document.querySelector('#custom-modal-close').addEventListener('click', closeCustomModal);
  document.querySelector('#custom-modal-cancel').addEventListener('click', () => {
    const onCancel = state.customModalCancel;
    state.customModalCancel = null;
    // onCancel puede devolver false para dejar el modal abierto (p. ej. «Copiar»).
    if (onCancel?.() === false) { state.customModalCancel = onCancel; return; }
    closeCustomModal();
  });
  customModal.addEventListener('click', event => { if (event.target === customModal) closeCustomModal(); });
}

// ── js/ui/image-viewer.js
/**
 * ui/image-viewer · Visor emergente de comprobantes y fotos.
 * Reemplaza los enlaces que abrían la imagen en una pestaña nueva: los navegadores
 * bloquean abrir imágenes guardadas como data: URL en otra pestaña (quedaba en blanco).
 * Cualquier elemento con [data-image-viewer] y la propiedad `viewerSrc` lo abre.
 */

const viewer = () => document.querySelector('#image-viewer');
let lastFocused = null;

function setZoom(zoomed) {
  const box = viewer();
  box.classList.toggle('is-zoomed', zoomed);
  const toggle = document.querySelector('#image-viewer-zoom');
  toggle.setAttribute('aria-pressed', String(zoomed));
  toggle.querySelector('.image-viewer-zoom-label').textContent = zoomed ? 'Ajustar a pantalla' : 'Ampliar';
}

/** Abre el visor con una imagen (data: URL o URL normal). */
function openImageViewer({ src, title = 'Comprobante', caption = '' }) {
  if (!src) return;
  lastFocused = document.activeElement;
  const box = viewer();
  document.querySelector('#image-viewer-title').textContent = title;
  document.querySelector('#image-viewer-caption').textContent = caption;
  const image = document.querySelector('#image-viewer-img');
  image.src = src;
  image.alt = title;
  setZoom(false);
  box.hidden = false;
  document.body.classList.add('modal-open');
  document.querySelector('#image-viewer-close').focus();
}

function closeImageViewer() {
  const box = viewer();
  if (!box || box.hidden) return;
  box.hidden = true;
  document.querySelector('#image-viewer-img').removeAttribute('src');
  if (!document.querySelector('.custom-modal-backdrop:not([hidden]), .modal-backdrop:not([hidden]), .ops-list-modal-backdrop:not([hidden])')) document.body.classList.remove('modal-open');
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
}

/** Prepara un botón para abrir el visor (la imagen se guarda en una propiedad, no en el HTML). */
function bindImageViewer(element, { src, title, caption }) {
  element.dataset.imageViewer = '';
  element.viewerSrc = src;
  element.viewerTitle = title;
  element.viewerCaption = caption || '';
  return element;
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_imageViewerModule() {
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-image-viewer]');
    if (!trigger) return;
    event.preventDefault();
    openImageViewer({ src: trigger.viewerSrc, title: trigger.viewerTitle, caption: trigger.viewerCaption });
  });
  document.querySelector('#image-viewer-close').addEventListener('click', closeImageViewer);
  document.querySelector('#image-viewer-zoom').addEventListener('click', () => setZoom(!viewer().classList.contains('is-zoomed')));
  document.querySelector('#image-viewer-img').addEventListener('click', () => setZoom(!viewer().classList.contains('is-zoomed')));
  viewer().addEventListener('click', event => { if (event.target === viewer()) closeImageViewer(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeImageViewer(); });
}

// ── js/ui/money-input.js
/**
 * ui/money-input · Campos de dinero con separador de miles (4.000.000).
 *
 * Los campos marcados con `data-money` se muestran con puntos mientras se escribe,
 * pero el resto del código sigue leyendo un número limpio:
 *  - `input.value` devuelve solo los dígitos ("4000000").
 *  - `new FormData(form)` también recibe los dígitos (evento `formdata`).
 * Los campos que se crean después (modales, tablas) se preparan solos.
 *
 * Con `data-money-thousands` (abonos, préstamos, gastos, seguros y base del trabajador; en el
 * admin la liquidación diaria, peticiones y abonos) TODO lo que se escribe está en miles:
 * 20 → 20.000, «20,5» o «20.5» → 20.500, 1.000 → 1.000.000, 10.000 → 10.000.000. Debajo del
 * campo se ve el valor real («= $ 20.000») y `value` devuelve ese valor en pesos.
 */


const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
/** Dígitos del texto, conservando el signo menos si va al inicio (p. ej. una base negativa). */
const onlyDigits = text => {
  const value = String(text ?? '').trim();
  const digits = value.replace(/\D/g, '');
  return digits && value.startsWith('-') ? `-${digits}` : digits;
};
const withDots = digits => (digits && digits !== '-' ? Number(digits).toLocaleString('es-CO', { maximumFractionDigits: 0 }) : digits);

/**
 * Monto escrito en miles → pesos (o null si no hay número).
 * La coma siempre es decimal; el punto es decimal solo si lo siguen 1 o 2 cifras al final
 * («20.5»); si no, separa miles («1.000»). Se admiten hasta 3 decimales (= pesos exactos).
 *   «20» → 20.000 · «20,5» / «20.5» → 20.500 · «1.000» → 1.000.000 · «10.000» → 10.000.000
 *   «1.000,5» → 1.000.500 · «0,75» → 750
 */
function parseThousandsAmount(text) {
  const trimmed = String(text ?? '').replace(/[\s$]/g, '');
  const negative = trimmed.startsWith('-'); // una base negativa que llega del código («-225»)
  const raw = negative ? trimmed.slice(1) : trimmed;
  let whole = raw;
  let fraction = '';
  const comma = raw.lastIndexOf(',');
  if (comma >= 0) { whole = raw.slice(0, comma); fraction = raw.slice(comma + 1); }
  else {
    const dotDecimal = raw.match(/^(.*)\.(\d{1,2})$/);
    if (dotDecimal) [, whole, fraction] = dotDecimal;
  }
  const wholeDigits = whole.replace(/\D/g, '');
  const fractionDigits = fraction.replace(/\D/g, '').slice(0, 3);
  if (!wholeDigits && !fractionDigits) return null;
  const amount = Number(wholeDigits || 0) * 1000 + Math.round(Number(`0.${fractionDigits || 0}`) * 1000);
  return negative ? -amount : amount;
}

/** Pesos → como se escriben en miles: 20000 → «20», 20500 → «20,5», 1000000 → «1.000». */
function thousandsText(pesos) {
  const amount = Math.round(Number(pesos));
  if (!Number.isFinite(amount) || String(pesos ?? '').trim() === '') return '';
  const whole = withDots(String(Math.trunc(amount / 1000)));
  const rest = Math.abs(amount % 1000);
  return rest ? `${whole},${String(rest).padStart(3, '0').replace(/0+$/, '')}` : whole;
}

function applyMinValidity(input) {
  const min = input.dataset.moneyMin;
  const digits = input.dataset.moneyThousands !== undefined ? String(parseThousandsAmount(nativeValue.get.call(input)) ?? '') : onlyDigits(nativeValue.get.call(input));
  const tooLow = min !== undefined && min !== '' && digits !== '' && Number(digits) < Number(min);
  input.setCustomValidity(tooLow ? `El valor debe ser de al menos ${withDots(String(min))}.` : '');
}

/** Valor real debajo del campo en miles. Va después del recuadro del campo si lo tiene. */
function thousandsHint(input) {
  if (input._moneyHint) return input._moneyHint;
  const hint = document.createElement('small');
  hint.className = 'money-thousands-hint';
  hint.id = `${input.id || `money-${Math.random().toString(36).slice(2, 8)}`}-hint`;
  hint.setAttribute('aria-live', 'polite');
  (input.closest('.amount-input-wrap') || input).after(hint);
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), hint.id].filter(Boolean).join(' '));
  input._moneyHint = hint;
  return hint;
}

function updateThousandsHint(input) {
  const amount = parseThousandsAmount(nativeValue.get.call(input));
  const hint = thousandsHint(input);
  hint.textContent = amount === null ? 'En miles: 20 = $ 20.000 · 20,5 = $ 20.500 · 1.000 = $ 1.000.000' : `= ${formatMoney(amount)}`;
  hint.classList.toggle('has-amount', amount !== null);
}

/**
 * Texto del campo en miles con la convención colombiana: puntos de miles y coma decimal
 * (hasta 3 decimales). «10000» → «10.000», «20,5» → «20,5».
 */
function thousandsDisplay(text) {
  const [whole, ...rest] = text.replace(/[^\d,]/g, '').split(',');
  const wholeDigits = whole.replace(/^0+(?=\d)/, '');
  if (!rest.length) return withDots(wholeDigits);
  return `${withDots(wholeDigits) || '0'},${rest.join('').slice(0, 3)}`;
}

/**
 * Campo en miles: se escribe en miles y se lee en pesos.
 *  - Si solo se escriben cifras, la app pone los puntos de miles («10000» → «10.000») y los
 *    rehace al borrar («10.000» ⌫ → «1.000»).
 *  - Un punto que escribe el trabajador se respeta y se lee con la regla de
 *    parseThousandsAmount: «20.5» = 20,5 mil y «1.000» = mil (mil miles).
 *  - La coma siempre es decimal.
 *  - Un monto pegado con «$» ya está en pesos y se toma tal cual.
 */
function enhanceThousandsInput(input) {
  const current = nativeValue.get.call(input);
  if (input.min !== '' && input.dataset.moneyMin === undefined) input.dataset.moneyMin = input.min;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.removeAttribute('min');
  input.removeAttribute('step');
  input._typedDot = false; // ¿el trabajador escribió un punto? (si no, los puntos son de la app)
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { const amount = parseThousandsAmount(nativeValue.get.call(this)); return amount === null ? '' : String(amount); },
    set(value) {
      // El código asigna pesos (p. ej. el seguro general): se muestran en miles (50000 → «50»).
      this._typedDot = false;
      nativeValue.set.call(this, thousandsText(value));
      updateThousandsHint(this);
      applyMinValidity(this);
    },
  });
  nativeValue.set.call(input, current ? thousandsText(onlyDigits(current)) : '');
  updateThousandsHint(input);
  input.addEventListener('input', event => {
    const text = nativeValue.get.call(input);
    const caret = input.selectionStart ?? text.length;
    let display;
    let position;
    if (['insertFromPaste', 'insertFromDrop', 'insertReplacementText'].includes(event.inputType)) {
      const pesos = text.includes('$') ? Number(onlyDigits(text.split(/,(?=\d{1,2}$)/)[0])) : parseThousandsAmount(text);
      input._typedDot = false;
      display = pesos === null || !Number.isFinite(pesos) || text.trim() === '' ? '' : thousandsText(pesos);
      position = display.length;
    } else {
      if (event.data === '.') input._typedDot = true;
      let clean = text.replace(/[^\d.,]/g, '');
      const firstComma = clean.indexOf(',');
      if (firstComma >= 0) clean = clean.slice(0, firstComma + 1) + clean.slice(firstComma + 1).replace(/,/g, '');
      if (!clean.includes('.')) input._typedDot = false;
      display = input._typedDot ? clean : thousandsDisplay(clean);
      const digitsBefore = onlyDigits(text.slice(0, caret)).length;
      const afterComma = text.slice(0, caret).includes(',');
      position = 0;
      for (let seen = 0; position < display.length && seen < digitsBefore; position += 1) if (/\d/.test(display[position])) seen += 1;
      const comma = display.indexOf(',');
      if (afterComma && comma >= 0 && position <= comma) position = comma + 1;
      if (event.data === '.' && input._typedDot) position = caret;
    }
    if (display !== text) {
      nativeValue.set.call(input, display);
      try { input.setSelectionRange(position, position); } catch { /* algunos tipos no admiten selección */ }
    }
    updateThousandsHint(input);
    applyMinValidity(input);
  });
}

/** Convierte un input numérico en campo de dinero con puntos. */
function enhanceMoneyInput(input) {
  if (!(input instanceof HTMLInputElement) || input.dataset.moneyReady) return;
  input.dataset.moneyReady = '1';
  if (input.dataset.moneyThousands !== undefined) { enhanceThousandsInput(input); return; }
  const current = onlyDigits(nativeValue.get.call(input).split(/[.,](?=\d{1,2}$)/)[0]);
  if (input.min !== '' && input.dataset.moneyMin === undefined) input.dataset.moneyMin = input.min;
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.removeAttribute('min');
  input.removeAttribute('step');
  if (input.placeholder) input.placeholder = input.placeholder.replace(/\d{4,}/g, match => withDots(match));
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { return onlyDigits(nativeValue.get.call(this)); },
    set(value) {
      const raw = String(value ?? '').split(/[.,](?=\d{1,2}$)/)[0]; // ignora decimales "1250000.5"
      nativeValue.set.call(this, withDots(onlyDigits(raw)));
      applyMinValidity(this);
    },
  });
  nativeValue.set.call(input, withDots(current));
  input.addEventListener('input', () => {
    const text = nativeValue.get.call(input);
    const caret = input.selectionStart ?? text.length;
    const digitsBefore = onlyDigits(text.slice(0, caret)).length;
    const formatted = withDots(onlyDigits(text));
    nativeValue.set.call(input, formatted);
    // Deja el cursor después del mismo número de dígitos que tenía antes de formatear.
    let position = 0;
    for (let seen = 0; position < formatted.length && seen < digitsBefore; position += 1) if (/\d/.test(formatted[position])) seen += 1;
    try { input.setSelectionRange(position, position); } catch { /* algunos tipos no admiten selección */ }
    applyMinValidity(input);
  });
}

function enhanceWithin(root) {
  if (root instanceof HTMLInputElement && root.matches('[data-money]')) enhanceMoneyInput(root);
  root.querySelectorAll?.('input[data-money]').forEach(enhanceMoneyInput);
}

function __mount_moneyInputModule() {
  enhanceWithin(document);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) enhanceWithin(node); })))
    .observe(document.body, { childList: true, subtree: true });
  // FormData lee el valor interno (con puntos): se reemplaza por los dígitos.
  document.addEventListener('formdata', event => {
    event.target.querySelectorAll('input[data-money][name]:not(:disabled)').forEach(input => event.formData.set(input.name, input.value));
  }, true);
}

// ── js/ui/navigation.js
/**
 * ui/navigation · Navegación entre vistas del trabajador (bottom-bar / sidebar).
 */






function showView(viewId) {
  if ((viewId === 'ruta-diaria' || viewId === 'mapa') && state.userRole !== 'worker') return;
  if (!document.getElementById(viewId)) return;
  state.currentView = viewId;
  views.forEach(view => {
    const active = view.id === viewId;
    view.hidden = !active;
    view.classList.toggle('is-active', active);
  });
  navItems.forEach(item => {
    const active = item.dataset.view === viewId;
    item.classList.toggle('is-selected', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  if (viewId === 'directorio') filterClientCards();
  if (viewId === 'ruta-diaria') renderRouteBuilder();
  if (viewId === 'mapa') renderClientMap();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_navigationModule() {
  navItems.forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
  document.querySelector('[data-back]').addEventListener('click', () => showView(state.previousView));
}

// ── js/ui/network.js
/**
 * ui/network · Indicador de conectividad (online/offline).
 */

function updateNetworkStatus() {
  const indicator = document.querySelector('#network-indicator');
  const online = navigator.onLine;
  indicator.classList.toggle('is-online', online);
  indicator.classList.toggle('is-offline', !online);
  indicator.setAttribute('aria-label', online ? 'Con conexión' : 'Sin conexión');
  indicator.title = online ? 'Con conexión' : 'Sin conexión';
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_networkModule() {
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
}

// ── js/ui/shortcuts.js
/**
 * ui/shortcuts · Atajos globales de teclado (Escape cierra el modal activo).
 */






/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_shortcutsModule() {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!customModal.hidden) closeCustomModal();
    else if (!newClientModal.hidden) closeNewClientModal();
    else if (!interestModal.hidden) closeInterestModal();
    else if (!modal.hidden) closePayment();
  });
}

// ── js/ui/theme.js
/**
 * ui/theme · Tema claro/oscuro persistido por dispositivo.
 */


function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  themeToggle.checked = light;
  themeDescription.textContent = light ? 'Apariencia clara' : 'Apariencia oscura';
  // Interruptor equivalente en Configuración del administrador.
  const adminToggle = document.querySelector('#admin-theme-toggle');
  if (adminToggle) adminToggle.checked = light;
  const adminDescription = document.querySelector('#admin-theme-description');
  if (adminDescription) adminDescription.textContent = themeDescription.textContent;
  try { localStorage.setItem('edgecredit-theme', light ? 'light' : 'dark'); } catch { /* almacenamiento opcional */ }
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function __mount_themeModule() {
  themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'light' : 'dark'));
}

// ── js/ui/toast.js
/**
 * ui/toast · Notificaciones breves no bloqueantes.
 */


function showToast(message) {
  appToast.textContent = message;
  appToast.hidden = false;
  appToast.classList.add('is-visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    appToast.classList.remove('is-visible');
    appToast.hidden = true;
  }, 3200);
}

// ── js/vendor/qrcode.js
/**
 * vendor/qrcode · Generador de códigos QR (sin dependencias de red).
 *
 * QRCode for JavaScript — Copyright (c) 2009 Kazuhiko Arase — licencia MIT
 * (http://www.opensource.org/licenses/mit-license.php). Adaptado a módulo ES y
 * encapsulado en una función para no exponer nombres globales.
 * "QR Code" es marca registrada de DENSO WAVE INCORPORATED.
 */

/* eslint-disable */
const createQRCode = (() => {
// ── QRMode ──
var QRMode = {
    MODE_NUMBER :       1 << 0,
    MODE_ALPHA_NUM :    1 << 1,
    MODE_8BIT_BYTE :    1 << 2,
    MODE_KANJI :        1 << 3
};

// ── QRErrorCorrectLevel ──
var QRErrorCorrectLevel = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};


// ── QRMaskPattern ──
var QRMaskPattern = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

// ── QRMath ──
var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}



// ── QRPolynomial ──

function QRPolynomial(num, shift) {
	if (num.length === undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] === 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var x = 0; x < e.getLength(); x++) {
			num[x] ^= QRMath.gexp(QRMath.glog(e.get(x) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};



// ── QR8bitByte ──

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function() {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};



// ── QRRSBlock ──

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock === undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = [];
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
};

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
};



// ── QRBitBuffer ──
function QRBitBuffer() {
	this.buffer = [];
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};



// ── QRUtil ──




var QRUtil = {

    PATTERN_POSITION_TABLE : [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],        
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)    | (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
        var d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );    
        }
        return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
        var d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );    
        }
        return (data << 12) | d;
    },

    getBCHDigit : function(data) {

        var digit = 0;

        while (data !== 0) {
            digit++;
            data >>>= 1;
        }

        return digit;
    },

    getPatternPosition : function(typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
        
        switch (maskPattern) {
            
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 === 0;

        default :
            throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

        var a = new QRPolynomial([1], 0);

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
        }

        return a;
    },

    getLengthInBits : function(mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 10;
            case QRMode.MODE_ALPHA_NUM  : return 9;
            case QRMode.MODE_8BIT_BYTE  : return 8;
            case QRMode.MODE_KANJI      : return 8;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 27) {

            // 10 - 26

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 12;
            case QRMode.MODE_ALPHA_NUM  : return 11;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 10;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 41) {

            // 27 - 40

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 14;
            case QRMode.MODE_ALPHA_NUM  : return 13;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 12;
            default :
                throw new Error("mode:" + mode);
            }

        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint : function(qrCode) {
        
        var moduleCount = qrCode.getModuleCount();
        var lostPoint = 0;
        var row = 0; 
        var col = 0;

        
        // LEVEL1
        
        for (row = 0; row < moduleCount; row++) {

            for (col = 0; col < moduleCount; col++) {

                var sameCount = 0;
                var dark = qrCode.isDark(row, col);

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }

                        if (r === 0 && c === 0) {
                            continue;
                        }

                        if (dark === qrCode.isDark(row + r, col + c) ) {
                            sameCount++;
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5);
                }
            }
        }

        // LEVEL2

        for (row = 0; row < moduleCount - 1; row++) {
            for (col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.isDark(row,     col    ) ) count++;
                if (qrCode.isDark(row + 1, col    ) ) count++;
                if (qrCode.isDark(row,     col + 1) ) count++;
                if (qrCode.isDark(row + 1, col + 1) ) count++;
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }

        // LEVEL3

        for (row = 0; row < moduleCount; row++) {
            for (col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col) && 
                        !qrCode.isDark(row, col + 1) && 
                         qrCode.isDark(row, col + 2) && 
                         qrCode.isDark(row, col + 3) && 
                         qrCode.isDark(row, col + 4) && 
                        !qrCode.isDark(row, col + 5) && 
                         qrCode.isDark(row, col + 6) ) {
                    lostPoint += 40;
                }
            }
        }

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                         qrCode.isDark(row + 2, col) &&
                         qrCode.isDark(row + 3, col) &&
                         qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                         qrCode.isDark(row + 6, col) ) {
                    lostPoint += 40;
                }
            }
        }

        // LEVEL4
        
        var darkCount = 0;

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col) ) {
                    darkCount++;
                }
            }
        }
        
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;       
    }

};



// ── QRCode ──
//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------
// Modified to work in node for this project (and some refactoring)
//---------------------------------------------------------------------






function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = [];
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var x = 0; x < this.dataList.length; x++) {
					var data = this.dataList[x];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache === null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c === 0 || c === 6) ) || 
                     (0 <= c && c <= 6 && (r === 0 || r === 6) ) || 
                     (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i === 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] !== null) {
				continue;
			}
			this.modules[r][6] = (r % 2 === 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] !== null) {
				continue;
			}
			this.modules[6][c] = (c % 2 === 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] !== null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (Math.abs(r) === 2 || 
                            Math.abs(c) === 2 ||
                            (r === 0 && c === 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        var mod;
	
		for (var i = 0; i < 18; i++) {
			mod = (!test && ( (bits >> i) & 1) === 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var x = 0; x < 18; x++) {
			mod = (!test && ( (bits >> x) & 1) === 1);
			this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
        var mod;
	
		// vertical		
		for (var v = 0; v < 15; v++) {
	
			mod = (!test && ( (bits >> v) & 1) === 1);
	
			if (v < 6) {
				this.modules[v][8] = mod;
			} else if (v < 8) {
				this.modules[v + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + v][8] = mod;
			}
		}
	
		// horizontal
		for (var h = 0; h < 15; h++) {
	
			mod = (!test && ( (bits >> h) & 1) === 1);
			
			if (h < 8) {
				this.modules[8][this.moduleCount - h - 1] = mod;
			} else if (h < 9) {
				this.modules[8][15 - h - 1 + 1] = mod;
			} else {
				this.modules[8][15 - h - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col === 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] === null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) === 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var x = 0; x < rsBlocks.length; x++) {
		totalDataCount += rsBlocks[x].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. (" + 
            buffer.getLengthInBits() + 
            ">" +  
            totalDataCount * 8 + 
            ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 !== 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
};

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var x = 0; x < ecdata[r].length; x++) {
            var modIndex = x + modPoly.getLength() - ecdata[r].length;
			ecdata[r][x] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var y = 0; y < rsBlocks.length; y++) {
		totalCodeCount += rsBlocks[y].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var z = 0; z < maxDcCount; z++) {
		for (var s = 0; s < rsBlocks.length; s++) {
			if (z < dcdata[s].length) {
				data[index++] = dcdata[s][z];
			}
		}
	}

	for (var xx = 0; xx < maxEcCount; xx++) {
		for (var t = 0; t < rsBlocks.length; t++) {
			if (xx < ecdata[t].length) {
				data[index++] = ecdata[t][xx];
			}
		}
	}

	return data;

};



return function createQRCode(text, level) {
  const qr = new QRCode(-1, QRErrorCorrectLevel[level || 'M']);
  qr.addData(text);
  qr.make();
  return qr;
};
})();

// ── app.js
const moneyInputModule = { mount: __mount_moneyInputModule };
const customModalModule = { mount: __mount_customModalModule };
const themeModule = { mount: __mount_themeModule };
const networkModule = { mount: __mount_networkModule };
const navigationModule = { mount: __mount_navigationModule };
const backNavigationModule = { mount: __mount_backNavigationModule };
const shortcutsModule = { mount: __mount_shortcutsModule };
const imageViewerModule = { mount: __mount_imageViewerModule };
const deviceTrustModule = { mount: __mount_deviceTrustModule };
const twoFactorModule = { mount: __mount_twoFactorModule };
const sessionModule = { mount: __mount_sessionModule };
const directoryModule = { mount: __mount_directoryModule };
const newClientModule = { mount: __mount_newClientModule };
const clientDetailModule = { mount: __mount_clientDetailModule };
const interestModule = { mount: __mount_interestModule };
const paymentModule = { mount: __mount_paymentModule };
const dailyRouteModule = { mount: __mount_dailyRouteModule };
const cashBoxModule = { mount: __mount_cashBoxModule };
const expensesModule = { mount: __mount_expensesModule };
const homeModule = { mount: __mount_homeModule };
const locationModule = { mount: __mount_locationModule };
const adminShellModule = { mount: __mount_adminShellModule };
const settlementModule = { mount: __mount_settlementModule };
const reportsModule = { mount: __mount_reportsModule };
const pendingModule = { mount: __mount_pendingModule };
const personnelModule = { mount: __mount_personnelModule };
const accessHoursModule = { mount: __mount_accessHoursModule };
const accountSettingsModule = { mount: __mount_accountSettingsModule };
const legacyImportModule = { mount: __mount_legacyImportModule };
const clientMapModule = { mount: __mount_clientMapModule };
const evidenceModule = { mount: __mount_evidenceModule };
const operationsListModule = { mount: __mount_operationsListModule };
const syncModule = { mount: __mount_syncModule };
/**
 * EdgeCredit · raíz de composición.
 * Monta cada módulo (contenedor) y ejecuta la secuencia de arranque.
 * No contiene lógica de negocio: solo orquesta.
 */























































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
  backNavigationModule,
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
    updateCashTotal();
    renderRouteBuilder();
  }
}

MODULES.forEach(module => module.mount());
boot();
})();
