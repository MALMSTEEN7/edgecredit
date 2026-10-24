/**
 * features/worker/location · GPS: envío desde el dispositivo del trabajador y consulta desde admin.
 */

import { shareLocationButton } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { persistBusinessData, shared } from '../../core/store.js';
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

// El trabajador decide una sola vez: si activa «Compartir GPS» queda activado en este
// celular (también al recargar o volver a entrar) hasta que él mismo lo apague.
const gpsShareKey = () => `edgecredit-gps-share-${state.activeWorker?.id || 'trabajador'}`;

function gpsSharePreference() {
  try { return localStorage.getItem(gpsShareKey()); } catch { return null; }
}

function setGpsSharePreference(value) {
  try { localStorage.setItem(gpsShareKey(), value); } catch { /* preferencia opcional */ }
}

function setShareButton(mode) {
  shareLocationButton.classList.toggle('is-sharing', mode === 'active');
  shareLocationButton.classList.toggle('is-searching', mode === 'searching');
  const label = { active: 'GPS activo', searching: 'Buscando GPS…', off: 'Compartir GPS' }[mode];
  shareLocationButton.querySelector('span').textContent = label;
  shareLocationButton.title = label; // en el celular solo se ve el ícono
}

function stopWatch() {
  if (state.locationWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.locationWatchId);
  state.locationWatchId = null;
  setShareButton('off');
}

function startWatch() {
  if (!navigator.geolocation || state.locationWatchId !== null) return;
  setShareButton('searching');
  state.locationWatchId = navigator.geolocation.watchPosition(position => {
    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      updated_at: new Date(position.timestamp || Date.now()).toISOString()
    };
    setShareButton('active');
    // Se guarda como máximo cada 15 s para no saturar la sincronización.
    if (Date.now() - state.lastLocationWrite > 15000) {
      state.lastLocationWrite = Date.now();
      shared.workerLocations[state.activeWorker.id] = location;
      persistBusinessData();
    }
  }, error => {
    if (error.code === error.PERMISSION_DENIED) {
      stopWatch();
      showToast('El permiso de ubicación está negado. Actívalo en los ajustes del navegador (candado junto a la dirección) para compartir el GPS.');
      return;
    }
    // Sin señal o tarda en responder: no se apaga, se sigue buscando.
    setShareButton('searching');
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}

function toggleWorkerLocationSharing() {
  if (!navigator.geolocation) {
    showToast('Este dispositivo no ofrece geolocalización del navegador.');
    return;
  }
  if (state.locationWatchId === null) {
    setGpsSharePreference('on');
    startWatch();
    return;
  }
  openCustomModal({
    title: '¿Dejar de compartir el GPS?',
    description: 'El administrador dejará de ver tu ubicación en el mapa hasta que lo vuelvas a activar.',
    submitLabel: 'Dejar de compartir',
    onSubmit: () => {
      setGpsSharePreference('off');
      stopWatch();
      showToast('Se detuvo el envío de ubicación.');
    }
  });
}

/**
 * Al entrar el trabajador: si ya lo había activado (o el permiso ya está concedido y nunca
 * lo apagó), el GPS vuelve a compartirse solo, sin preguntar otra vez.
 */
export async function resumeWorkerLocationSharing() {
  if (!navigator.geolocation || state.userRole !== 'worker') return;
  const preference = gpsSharePreference();
  if (preference === 'off') { stopWatch(); return; }
  let granted = preference === 'on';
  if (!granted) {
    try { granted = (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted'; } catch { /* sin Permissions API */ }
  }
  if (granted) { setGpsSharePreference('on'); startWatch(); } else setShareButton('off');
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  shareLocationButton.addEventListener('click', toggleWorkerLocationSharing);
  // El celular pausa el GPS con la app en segundo plano: al volver se reanuda si está activado.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.userRole === 'worker' && !shareLocationButton.hidden && gpsSharePreference() === 'on') startWatch();
  });
}
