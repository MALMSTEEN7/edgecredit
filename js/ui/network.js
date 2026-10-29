/**
 * ui/network · Indicador de conectividad (online/offline).
 */

// El ícono de wifi se quitó: la conexión la muestra el indicador de sincronización (core/sync.js).
export function updateNetworkStatus() {
  const online = navigator.onLine;
  // «En línea» de la tarjeta de la base: refleja la conexión real (y titila mientras hay conexión).
  document.querySelectorAll('.sync-indicator').forEach(badge => {
    badge.classList.toggle('is-offline', !online);
    const dot = badge.querySelector('span');
    badge.replaceChildren(...(dot ? [dot] : []), ` ${online ? 'En línea' : 'Sin conexión'}`);
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
}
