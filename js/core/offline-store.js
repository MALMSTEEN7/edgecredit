/**
 * core/offline-store · Copia local de los datos del servidor en el celular (IndexedDB).
 *
 * Con servidor, cada usuario guarda aquí su propia copia (la ruta del trabajador, o todo en el
 * caso del admin) junto con lo que se sabe del servidor. Así la app abre y trabaja sin señal,
 * y al volver la conexión solo descarga lo que cambió.
 *
 * - Cerrar sesión NO borra la copia (los cambios sin enviar no se pierden).
 * - Se borra cuando el administrador desactiva el acceso de esa persona (wipeOfflineUser).
 * - localStorage tiene un tope de ~5 MB; IndexedDB permite mucho más.
 */

const OFFLINE_DB_NAME = 'edgecredit-offline';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE = 'kv';

let offlineDbPromise = null;

function openOfflineDb() {
  if (offlineDbPromise) return offlineDbPromise;
  offlineDbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('IndexedDB no disponible')); return; }
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(OFFLINE_STORE)) request.result.createObjectStore(OFFLINE_STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir la copia local'));
    request.onblocked = () => reject(new Error('La copia local está bloqueada por otra pestaña'));
  }).catch(error => { offlineDbPromise = null; throw error; });
  return offlineDbPromise;
}

function offlineRun(mode, action) {
  return openOfflineDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, mode);
    const request = action(tx.objectStore(OFFLINE_STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error || request?.error);
    tx.onabort = () => reject(tx.error || new Error('Escritura cancelada (¿sin espacio?)'));
  }));
}

export async function offlineGet(key) {
  try { return (await offlineRun('readonly', store => store.get(key))) ?? null; } catch { return null; }
}

/** Escrituras en cola por clave: si llega otra mientras se escribe, solo se escribe la última. */
const offlineQueued = new Map();
const offlineWriting = new Set();
const offlineWaiters = [];

async function offlineFlush(key) {
  offlineWriting.add(key);
  while (offlineQueued.has(key)) {
    const value = offlineQueued.get(key);
    offlineQueued.delete(key);
    try { await offlineRun('readwrite', store => store.put(value, key)); } catch (error) { console.warn('Copia local sin guardar', error); }
  }
  offlineWriting.delete(key);
  if (!offlineWriting.size) offlineWaiters.splice(0).forEach(resolve => resolve());
}

export function offlinePut(key, value) {
  offlineQueued.set(key, value);
  if (!offlineWriting.has(key)) offlineFlush(key);
}

/** Espera a que terminen las escrituras pendientes. */
export function offlineSaved() {
  return offlineWriting.size || offlineQueued.size ? new Promise(resolve => offlineWaiters.push(resolve)) : Promise.resolve();
}

export async function offlineDelete(key) {
  offlineQueued.delete(key);
  await offlineSaved();
  try { await offlineRun('readwrite', store => store.delete(key)); } catch { /* sin IndexedDB */ }
}

/** Pide al navegador que no borre la copia por falta de espacio. */
export function requestPersistentOfflineStorage() {
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* opcional */ }
}
