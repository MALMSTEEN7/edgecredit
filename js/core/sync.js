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

import { backend, backendErrorMessage } from './backend.js';
import { state } from './state.js';
import { clients, emptyRoute, pendingRequests, personnel, routeSettlements, security, shared, onPersist } from './store.js';
import { isWithinSchedule } from '../domain/access-schedule.js';
import { routeKey } from '../shared/format.js';
import { showToast } from '../ui/toast.js';

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
export function setRenderHook(fn) { renderHook = fn; }
/** Se llama cuando cambia el perfil propio (p. ej. el admin desactivó el acceso). */
export function setAccessHook(fn) { accessHook = fn; }
export function syncActive() { return Boolean(syncSession); }
/** Rol de la sesión sincronizada ('admin' | 'worker'), o null sin servidor. */
export function syncRole() { return syncSession?.role || null; }

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
export async function startSync({ userId, role, routeId, routeName }) {
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

export async function stopSync() {
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

export function mount() {
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
