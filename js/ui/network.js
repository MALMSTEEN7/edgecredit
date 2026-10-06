/**
 * ui/network · Indicador de conectividad (online/offline).
 */

export function updateNetworkStatus() {
  const indicator = document.querySelector('#network-indicator');
  const online = navigator.onLine;
  indicator.classList.toggle('is-online', online);
  indicator.classList.toggle('is-offline', !online);
  indicator.setAttribute('aria-label', online ? 'Con conexión' : 'Sin conexión');
  indicator.title = online ? 'Con conexión' : 'Sin conexión';
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
}
