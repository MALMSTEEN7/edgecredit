/**
 * core/sync · Sincronización con el servidor (Supabase) para trabajar en equipo.
 *
 * - Al iniciar sesión descarga lo que el usuario puede ver (el admin todo; el
 *   trabajador solo su ruta: lo filtra la base de datos con RLS).
 * - Cada vez que la app guarda (persistBusinessData) compara cada registro con la
 *   última versión enviada y sube solo lo que cambió (clientes, rutas, estado de la
 *   ruta, solicitudes, personal y ajustes).
 * - Los cambios de otros usuarios llegan en tiempo real y se repinta la pantalla.
 * - Sin internet, los cambios quedan en una cola (también guardada en el navegador)
 *   y se envían al volver la conexión.
 */

import { backend, backendErrorMessage } from './backend.js';
import { state } from './state.js';
import { clients, emptyRoute, pendingRequests, personnel, routeSettlements, security, shared, onPersist } from './store.js';
import { routeKey } from '../shared/format.js';
import { showToast } from '../ui/toast.js';

const TABLE_KEYS = { clients: 'id', routes: 'id', route_state: 'route_id', pending_requests: 'id', profiles: 'user_id', app_settings: 'key' };

let syncSession = null;          // { userId, role, routeId }
let lastSynced = new Map();  // `${tabla}:${clave}` → JSON enviado/recibido
let flushTimer = null;
let flushing = false;
let channel = null;
let renderHook = () => {};
let accessHook = () => {};
let refreshTimer = null;
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
    rows.app_settings = [{ key: 'worker_access', data: security.workerAccess }];
  }
  return rows;
}

// ── Envío de cambios ──

function readOutbox() {
  try { return JSON.parse(localStorage.getItem(outboxKey()) || '[]'); } catch { return []; }
}

function writeOutbox(items) {
  try { localStorage.setItem(outboxKey(), JSON.stringify(items)); } catch { /* opcional */ }
}

function scheduleFlush(delay = 400) {
  if (!syncSession) return;
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flush, delay);
}

async function flush() {
  if (!syncSession || flushing) return;
  flushing = true;
  try {
    const db = await backend();
    const rows = collectRows();
    const pending = [];
    Object.entries(rows).forEach(([table, list]) => {
      const keyName = TABLE_KEYS[table];
      const present = new Set();
      list.forEach(row => {
        const id = `${table}:${row[keyName]}`;
        present.add(id);
        if (lastSynced.get(id) !== stable(row)) pending.push({ table, op: 'upsert', row, id });
      });
      // Borrados: solo el admin elimina clientes, rutas (y su estado) y solicitudes.
      if (syncSession.role === 'admin' && ['clients', 'pending_requests', 'routes', 'route_state'].includes(table)) {
        [...lastSynced.keys()].filter(id => id.startsWith(`${table}:`) && !present.has(id))
          .forEach(id => pending.push({ table, op: 'delete', key: id.slice(table.length + 1), id }));
      }
    });
    if (!pending.length) { writeOutbox([]); return; }
    writeOutbox(pending);
    if (!navigator.onLine) return;
    const failed = [];
    for (const table of Object.keys(TABLE_KEYS)) {
      const upserts = pending.filter(item => item.table === table && item.op === 'upsert');
      for (let i = 0; i < upserts.length; i += 50) {
        const chunk = upserts.slice(i, i + 50);
        const query = table === 'profiles'
          ? Promise.all(chunk.map(item => db.from('profiles').update({ route_id: item.row.route_id, access_enabled: item.row.access_enabled, data: item.row.data, updated_at: new Date().toISOString() }).eq('user_id', item.row.user_id)))
            .then(results => ({ error: results.find(result => result.error)?.error || null }))
          : db.from(table).upsert(chunk.map(item => ({ ...item.row, updated_at: new Date().toISOString() })), { onConflict: TABLE_KEYS[table] });
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
    writeOutbox(failed);
    if (failed.length) scheduleFlush(15000);
  } catch (error) {
    reportError(error);
    scheduleFlush(15000);
  } finally {
    flushing = false;
    updateSyncBadge();
  }
}

function reportError(error) {
  if (Date.now() - lastErrorToast < 20000) return;
  lastErrorToast = Date.now();
  showToast(`Cambios pendientes de enviar: ${backendErrorMessage(error)}`);
}

function updateSyncBadge() {
  const pending = syncSession ? readOutbox().length : 0;
  document.querySelectorAll('.sync-status').forEach(badge => {
    badge.hidden = !syncSession;
    badge.dataset.state = !navigator.onLine ? 'offline' : pending ? 'pending' : 'ok';
    badge.title = !navigator.onLine ? 'Sin conexión: los cambios se enviarán al volver internet' : pending ? `${pending} cambio(s) por enviar al servidor` : 'Datos sincronizados con el servidor';
    badge.querySelector('span').textContent = !navigator.onLine ? 'Sin conexión' : pending ? 'Enviando…' : 'Sincronizado';
  });
}

// ── Recepción de datos ──

function replaceObject(target, source) {
  Object.keys(target).forEach(key => delete target[key]);
  Object.assign(target, source);
}

function applyRouteState(routeId, data = {}) {
  state.dailyRouteOrder[routeId] = data.dailyRouteOrder || [];
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

/** Aplica una fila recibida del servidor al estado de la app. */
/** Forma de una fila tal como la envía esta app (para comparar con lo recibido). */
function normalizeRow(table, row) {
  if (table === 'profiles') return { user_id: row.user_id, route_id: row.route_id, access_enabled: row.access_enabled !== false, data: row.data };
  if (table === 'app_settings') return { key: row.key, data: row.data };
  if (table === 'routes') return { id: row.id, data: row.data };
  if (table === 'route_state') return { route_id: row.route_id, data: row.data };
  return { id: row.id, route_id: row.route_id, data: row.data };
}

/** Fila local actual de una clave (o null si no existe en este dispositivo). */
function localRow(table, key) {
  const rows = collectRows()[table] || [];
  return rows.find(row => String(row[TABLE_KEYS[table]]) === String(key)) || null;
}

function applyRow(table, row, removed = false) {
  const keyName = TABLE_KEYS[table];
  const id = `${table}:${row[keyName]}`;
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
      if (me) replaceObject(me, profileToWorker(row));
      accessHook(row);
      return;
    }
    if (syncSession?.role !== 'admin' || row.role !== 'worker') return;
    const worker = profileToWorker(row);
    const index = personnel.findIndex(item => item.id === row.user_id);
    if (index >= 0) replaceObject(personnel[index], worker); else personnel.push(worker);
    lastSynced.set(id, stable(profileRow(personnel.find(item => item.id === row.user_id))));
  } else if (table === 'app_settings' && row.key === 'worker_access') {
    Object.assign(security.workerAccess, row.data || {});
    lastSynced.set(id, stable({ key: 'worker_access', data: security.workerAccess }));
  }
}

async function fetchAll() {
  const db = await backend();
  const tables = ['routes', 'route_state', 'clients', 'pending_requests', 'app_settings'];
  if (syncSession.role === 'admin') tables.push('profiles');
  const results = await Promise.all(tables.map(table => {
    const query = db.from(table).select('*');
    return table === 'profiles' ? query.eq('role', 'worker') : query;
  }));
  const failure = results.find(result => result.error);
  if (failure) throw failure.error;
  // Limpia lo que haya en memoria y carga lo del servidor.
  Object.keys(clients).forEach(key => delete clients[key]);
  pendingRequests.splice(0, pendingRequests.length);
  if (syncSession.role === 'admin') {
    personnel.splice(0, personnel.length);
    // El admin ve exactamente las rutas del servidor (nada de rutas locales sobrantes).
    Object.keys(routeSettlements).forEach(key => delete routeSettlements[key]);
  }
  if (syncSession.role === 'worker') Object.keys(routeSettlements).filter(key => key !== syncSession.routeId).forEach(key => delete routeSettlements[key]);
  lastSynced = new Map();
  results.forEach((result, index) => (result.data || []).forEach(row => applyRow(tables[index], row)));
  if (syncSession.role === 'worker' && !routeSettlements[syncSession.routeId]) routeSettlements[syncSession.routeId] = emptyRoute(syncSession.routeName || syncSession.routeId);
}

function subscribeRealtime(db) {
  channel?.unsubscribe?.();
  channel = db.channel(`edgecredit-${syncSession.userId}`);
  Object.keys(TABLE_KEYS).forEach(table => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
      if (!syncSession) return;
      const removed = payload.eventType === 'DELETE';
      const row = removed ? payload.old : payload.new;
      if (!row) return;
      if (table === 'profiles' && syncSession.role === 'worker' && row.user_id !== syncSession.userId) return;
      const id = `${table}:${row[TABLE_KEYS[table]]}`;
      // Eco de un cambio propio: ya está aplicado.
      if (!removed && lastSynced.get(id) === stable(normalizeRow(table, row))) return;
      // Si aquí hay cambios sin enviar de ese mismo registro, gana el último en guardar:
      // se conserva el local y se envía.
      const local = removed ? null : localRow(table, row[TABLE_KEYS[table]]);
      if (local && lastSynced.has(id) && stable(local) !== lastSynced.get(id)) { scheduleFlush(100); return; }
      applyRow(table, row, removed);
      queueRender();
    });
  });
  channel.subscribe();
}

let renderTimer = null;
function queueRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => { try { renderHook(); } catch (error) { console.error(error); } }, 150);
}

/** Inicia la sincronización tras un inicio de sesión exitoso. */
export async function startSync({ userId, role, routeId, routeName }) {
  syncSession = { userId, role, routeId, routeName };
  await fetchAll();
  // Cambios que quedaron sin enviar en una sesión anterior en este dispositivo.
  const outbox = readOutbox();
  if (outbox.length) {
    outbox.filter(item => item.op === 'upsert').forEach(item => applyRow(item.table, item.row));
    lastSynced = new Map([...lastSynced].filter(([id]) => !outbox.some(item => item.id === id)));
  }
  const db = await backend();
  subscribeRealtime(db);
  window.clearInterval(refreshTimer);
  // Respaldo por si el tiempo real no está activo: refresca cada 2 minutos.
  refreshTimer = window.setInterval(async () => {
    if (!syncSession || flushing || readOutbox().length) return;
    try { await fetchAll(); queueRender(); } catch { /* se reintenta en el siguiente ciclo */ }
  }, 120000);
  scheduleFlush(outbox.length ? 50 : 1500);
  updateSyncBadge();
}

export async function stopSync() {
  if (syncSession) await flush().catch(() => {});
  window.clearTimeout(flushTimer);
  window.clearInterval(refreshTimer);
  channel?.unsubscribe?.();
  channel = null;
  syncSession = null;
  lastSynced = new Map();
  updateSyncBadge();
}

export function mount() {
  onPersist(() => scheduleFlush());
  window.addEventListener('online', () => { updateSyncBadge(); scheduleFlush(100); });
  window.addEventListener('offline', updateSyncBadge);
}
