/**
 * ui/navigation · Navegación entre vistas del trabajador (bottom-bar / sidebar).
 */

import { navItems, views } from '../core/dom.js';
import { state } from '../core/state.js';
import { filterClientCards } from '../features/clients/directory.js';
import { renderRouteBuilder } from '../features/daily-route/daily-route.js';
import { renderClientMap } from '../features/admin/client-map.js';

// Posición de cada lista al salir de ella: al volver de la ficha de un cliente se queda donde
// iba (y en la fila del cliente que estaba viendo), en vez de saltar al principio.
const LIST_VIEWS = ['inicio', 'directorio', 'ruta-diaria'];
const listScroll = {};

/** Al volver a una lista: la misma altura que tenía y, si hace falta, la fila del cliente visto. */
function restoreListPosition(viewId) {
  window.scrollTo({ top: listScroll[viewId] || 0, behavior: 'instant' });
  const id = state.activeClient;
  if (!id) return;
  const row = [...document.querySelectorAll(`#${viewId} [data-client="${CSS.escape(id)}"], #${viewId} [data-route-client="${CSS.escape(id)}"]`)].find(node => !node.hidden && node.offsetParent);
  if (!row) return;
  const box = row.getBoundingClientRect();
  if (box.top < 0 || box.bottom > window.innerHeight) row.scrollIntoView({ block: 'center', behavior: 'instant' });
  row.classList.add('is-last-viewed');
  window.setTimeout(() => row.classList.remove('is-last-viewed'), 1600);
}

export function showView(viewId) {
  if ((viewId === 'ruta-diaria' || viewId === 'mapa') && state.userRole !== 'worker') return;
  if (!document.getElementById(viewId)) return;
  const leaving = state.currentView;
  if (LIST_VIEWS.includes(leaving) && leaving !== viewId) listScroll[leaving] = window.scrollY;
  const backFromClient = leaving === 'detalle-cliente' && LIST_VIEWS.includes(viewId);
  state.currentView = viewId;
  views.forEach(view => {
    const active = view.id === viewId;
    view.hidden = !active;
    view.classList.toggle('is-active', active);
  });
  navItems.forEach(item => {
    const active = item.dataset.view === viewId;
    item.classList.toggle('is-selected', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  if (viewId === 'directorio') filterClientCards();
  if (viewId === 'ruta-diaria') renderRouteBuilder();
  if (viewId === 'mapa') renderClientMap();
  if (backFromClient) window.requestAnimationFrame(() => restoreListPosition(viewId));
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  navItems.forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
  document.querySelector('[data-back]').addEventListener('click', () => showView(state.previousView));
}
