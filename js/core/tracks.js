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

import { backend, backendEnabled } from './backend.js';
import { localDateISO } from '../shared/dates.js';

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
export function recordTrackPoint(workerId, routeId, point) {
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
export function resumeTrackUpload(workerId) {
  if (backendEnabled() && workerId) scheduleTrackFlush(workerId, 500);
}

/** Recorrido de un trabajador en un día (yyyy-mm-dd), en orden de hora. */
export async function loadTrack(workerId, dateISO) {
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
export function subscribeTrack(workerId, onPoint) {
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
export function trackDistance(a, b) {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
