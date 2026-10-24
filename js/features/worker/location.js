/**
 * features/worker/location · GPS: envío desde el dispositivo del trabajador y consulta desde admin.
 */

import { shareLocationButton } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { persistBusinessData, shared } from '../../core/store.js';
import { recordTrackPoint, resumeTrackUpload, trackDistance } from '../../core/tracks.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';

/** Última ubicación enviada por el trabajador (llega por la sincronización con el servidor). */
export function fetchWorkerLocation(worker) {
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
// se puede apagar. El botón de la barra es solo un testigo del estado de la señal.
// Cada posición actualiza la «última ubicación» y, cada cierto movimiento, agrega un punto
// al recorrido del día (core/tracks.js) que el admin ve en el mapa.
const TRACK_MIN_SECONDS = 20;        // como máximo un punto cada 20 s…
const TRACK_MIN_METERS = 15;         // …si se movió al menos 15 m
const TRACK_IDLE_SECONDS = 120;      // quieto: un punto cada 2 min (para saber que sigue ahí)
const TRACK_MAX_ACCURACY = 100;      // posiciones peores que 100 m no entran al recorrido
let gpsStatus = 'off';
let lastTrackPoint = null;

const GPS_STATUS = {
  active: { label: 'GPS activo', detail: 'Tu ubicación se está enviando al administrador.' },
  searching: { label: 'Buscando GPS…', detail: 'El celular está buscando señal de GPS. Sal a cielo abierto si tarda; se envía sola apenas la encuentre.' },
  denied: { label: 'GPS sin permiso', detail: 'El permiso de ubicación está bloqueado. Toca el candado junto a la dirección de la página → Permisos → Ubicación → Permitir, y recarga la página.' },
  unsupported: { label: 'Sin GPS', detail: 'Este navegador no da la ubicación. Usa Chrome en el celular de la empresa.' },
  off: { label: 'GPS', detail: '' },
};

function setGpsStatus(mode) {
  gpsStatus = mode;
  shareLocationButton.classList.toggle('is-sharing', mode === 'active');
  shareLocationButton.classList.toggle('is-searching', mode === 'searching');
  shareLocationButton.classList.toggle('is-denied', mode === 'denied' || mode === 'unsupported');
  const { label } = GPS_STATUS[mode];
  shareLocationButton.querySelector('span').textContent = label;
  shareLocationButton.title = label; // en el celular solo se ve el ícono
  shareLocationButton.setAttribute('aria-label', `Estado del GPS: ${label}`);
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

/** Al tocar el testigo: solo informa el estado (el GPS no se puede apagar). */
function showGpsStatus() {
  if (gpsStatus === 'denied') { startWatch(); } // por si ya dieron el permiso
  const { label, detail } = GPS_STATUS[gpsStatus];
  const last = lastTrackPoint ? new Date(lastTrackPoint.recordedAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : null;
  openCustomModal({
    title: label,
    description: `${detail}${last ? ` Último punto del recorrido: ${last}.` : ''} El GPS de este celular de la empresa permanece activo mientras uses la app.`,
    submitLabel: 'Entendido',
    onSubmit: () => {}
  });
}

/** Al entrar el trabajador el GPS se activa solo (el permiso se pide una única vez). */
export function resumeWorkerLocationSharing() {
  if (state.userRole !== 'worker') return;
  lastTrackPoint = null;
  startWatch();
  resumeTrackUpload(state.activeWorker?.id);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  shareLocationButton.addEventListener('click', showGpsStatus);
  // El celular pausa el GPS con la app en segundo plano: al volver se reanuda solo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || state.userRole !== 'worker' || shareLocationButton.hidden) return;
    startWatch();
    resumeTrackUpload(state.activeWorker?.id);
  });
  window.addEventListener('online', () => { if (state.userRole === 'worker') resumeTrackUpload(state.activeWorker?.id); });
}
