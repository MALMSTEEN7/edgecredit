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

function startWorkerLocationSharing() {
  if (!navigator.geolocation) {
    showToast('Este dispositivo no ofrece geolocalización del navegador.');
    return;
  }
  if (state.locationWatchId !== null) {
    navigator.geolocation.clearWatch(state.locationWatchId);
    state.locationWatchId = null;
    shareLocationButton.classList.remove('is-sharing');
    shareLocationButton.querySelector('span').textContent = 'Compartir GPS';
    showToast('Se detuvo el envío de ubicación.');
    return;
  }
  shareLocationButton.querySelector('span').textContent = 'Solicitando GPS…';
  state.locationWatchId = navigator.geolocation.watchPosition(position => {
    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      updated_at: new Date(position.timestamp || Date.now()).toISOString()
    };
    shareLocationButton.classList.add('is-sharing');
    shareLocationButton.querySelector('span').textContent = 'GPS activo';
    // Se guarda como máximo cada 15 s para no saturar la sincronización.
    if (Date.now() - state.lastLocationWrite > 15000) {
      state.lastLocationWrite = Date.now();
      shared.workerLocations[state.activeWorker.id] = location;
      persistBusinessData();
    }
  }, error => {
    navigator.geolocation.clearWatch(state.locationWatchId);
    state.locationWatchId = null;
    shareLocationButton.classList.remove('is-sharing');
    shareLocationButton.querySelector('span').textContent = 'Compartir GPS';
    showToast(error.code === error.PERMISSION_DENIED ? 'Activa el permiso de ubicación para compartir el GPS.' : 'No se pudo obtener la ubicación del dispositivo.');
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  shareLocationButton.addEventListener('click', startWorkerLocationSharing);
}
