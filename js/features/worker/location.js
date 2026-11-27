/**
 * features/worker/location · GPS: envío desde el dispositivo del trabajador y consulta desde admin.
 */

import { gpsIndicator } from '../../core/dom.js';
import { backend, backendEnabled } from '../../core/backend.js';
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
  announceGps();
}

// ── Estado de la ubicación para el resto de la app (aviso en Inicio, indicador en «Nuevo
// cliente») y para el administrador (Personal). ──

/**
 * Estado de la ubicación de este celular:
 *  active      el GPS da posición
 *  searching   hay permiso pero todavía no hay señal (o la ubicación del celular está apagada)
 *  prompt      el celular todavía no ha preguntado / no ha aceptado el permiso
 *  denied      permiso bloqueado
 *  unsupported el navegador no da ubicación
 */
export function gpsState() {
  if (gpsMode === 'unsupported' || !navigator.geolocation) return 'unsupported';
  if (gpsMode === 'denied' || gpsPermission === 'denied') return 'denied';
  if (gpsMode === 'active') return 'active';
  if (gpsPermission === 'prompt') return 'prompt';
  return 'searching';
}

let searchingSince = 0;
function announceGps() {
  const current = gpsState();
  searchingSince = current === 'searching' ? searchingSince || Date.now() : 0;
  document.dispatchEvent(new CustomEvent('edgecredit:gps-status', { detail: { state: current } }));
  reportGpsState(current);
}

/** Anota en el servidor el estado de la ubicación del trabajador (lo ve el admin en Personal). */
const GPS_REPORT_KEY = 'edgecredit-gps-report';
let gpsReportTimer = null;
let gpsReportPending = '';
function reportGpsState(current) {
  if (state.userRole !== 'worker' || !backendEnabled() || !state.activeWorker?.id) return;
  // Cada posición vuelve a avisar el mismo estado: solo se reprograma si el estado cambió.
  if (current === gpsReportPending) return;
  gpsReportPending = current;
  window.clearTimeout(gpsReportTimer);
  // «Buscando» solo se anota si dura (al abrir la app siempre empieza buscando).
  const delay = current === 'searching' || current === 'prompt' ? 90000 : 1500;
  gpsReportTimer = window.setTimeout(async () => {
    gpsReportPending = '';
    if (gpsState() !== current || state.userRole !== 'worker') return;
    const workerId = state.activeWorker?.id;
    let last = null;
    try { last = JSON.parse(localStorage.getItem(GPS_REPORT_KEY) || 'null'); } catch { /* opcional */ }
    if (last?.worker === workerId && last.state === current && Date.now() - last.at < 6 * 3600e3) return;
    try {
      const db = await backend();
      const { error } = await db.from('worker_device_status').upsert({ worker_id: workerId, gps: current, detail: navigator.userAgent.slice(0, 200), updated_at: new Date().toISOString() });
      if (!error) localStorage.setItem(GPS_REPORT_KEY, JSON.stringify({ worker: workerId, state: current, at: Date.now() }));
    } catch { /* sin señal: se anota la próxima vez */ }
  }, delay);
}

/** Los intentos de ubicación al crear un cliente también cuentan (p. ej. permiso negado). */
function noteLocationResult(event) {
  const reason = event.detail?.reason;
  if (state.userRole !== 'worker') return;
  if (!reason) { if (gpsMode !== 'active') setGpsStatus('active'); return; }
  if (reason === 'denied') {
    if (state.locationWatchId !== null) { navigator.geolocation?.clearWatch(state.locationWatchId); state.locationWatchId = null; }
    setGpsStatus('denied');
  }
}

/**
 * «Activar ubicación»: vuelve a pedir el permiso. Si el celular ya lo bloqueó (no vuelve a
 * preguntar), se muestran los pasos para activarlo a mano.
 */
export function activateGps() {
  if (state.userRole !== 'worker') return;
  if (gpsState() === 'unsupported' || gpsPermission === 'denied') { openGpsHelp(); return; }
  if (state.locationWatchId !== null) { navigator.geolocation?.clearWatch(state.locationWatchId); state.locationWatchId = null; }
  startWatch();
  // Si el celular no pregunta (bloqueado) o la ubicación está apagada, se explica cómo activarla.
  window.setTimeout(() => { if (gpsState() === 'denied' || gpsState() === 'unsupported') openGpsHelp(); }, 2500);
  window.setTimeout(() => { if (gpsState() === 'searching') openGpsHelp('searching'); }, 15000);
}

export function openGpsHelp(reason = gpsState()) {
  const help = document.querySelector('#gps-help');
  if (!help) return;
  document.querySelector('#gps-help-reason').textContent = reason === 'searching'
    ? 'El celular no está dando la ubicación. Lo más común es que la ubicación (GPS) del celular esté apagada.'
    : reason === 'unsupported' ? 'Este navegador no da la ubicación. Usa Google Chrome.'
      : 'El permiso de ubicación está bloqueado para EdgeCredit. Así se activa:';
  help.hidden = false;
  document.body.classList.add('modal-open');
}

function closeGpsHelp() {
  document.querySelector('#gps-help').hidden = true;
  if (document.querySelector('.modal-backdrop:not([hidden])') === null) document.body.classList.remove('modal-open');
}

/** Aviso en Inicio cuando la ubicación no está funcionando. */
function renderGpsBanner() {
  const banner = document.querySelector('#gps-banner');
  if (!banner) return;
  const current = gpsState();
  const show = state.userRole === 'worker' && (current === 'denied' || current === 'unsupported' || current === 'prompt' || (current === 'searching' && searchingSince && Date.now() - searchingSince > 60000));
  banner.hidden = !show;
  if (!show) return;
  document.querySelector('#gps-banner-text').textContent = current === 'denied' ? 'La ubicación de este celular está bloqueada: los clientes nuevos quedan sin ubicación.'
    : current === 'unsupported' ? 'Este navegador no da la ubicación. Usa Google Chrome.'
      : current === 'prompt' ? 'Falta aceptar el permiso de ubicación.'
        : 'El celular no está dando la ubicación (¿GPS apagado?).';
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
    announceGps();
    permission.addEventListener('change', () => {
      gpsPermission = permission.state;
      if (permission.state === 'granted' && state.userRole === 'worker') {
        if (gpsMode === 'denied') gpsMode = 'off';
        startWatch();
      }
      renderGpsSetting();
      announceGps();
    });
  }).catch(() => renderGpsSetting());
}

/** Al entrar el trabajador el GPS se activa solo (el permiso se pide una única vez). */
export function resumeWorkerLocationSharing() {
  if (state.userRole !== 'worker') return;
  lastTrackPoint = null;
  startWatch();
  resumeTrackUpload(state.activeWorker?.id);
  renderGpsSetting();
  announceGps();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  watchGpsPermission();
  document.addEventListener('edgecredit:gps-result', noteLocationResult);
  document.addEventListener('edgecredit:gps-status', renderGpsBanner);
  window.setInterval(renderGpsBanner, 30000);
  document.querySelector('#gps-banner-activate').addEventListener('click', activateGps);
  document.querySelector('#gps-help-close').addEventListener('click', closeGpsHelp);
  document.querySelector('#gps-help-retry').addEventListener('click', () => { closeGpsHelp(); window.location.reload(); });
  document.querySelector('#gps-help').addEventListener('click', event => { if (event.target.id === 'gps-help') closeGpsHelp(); });
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
