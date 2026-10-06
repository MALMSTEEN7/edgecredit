/**
 * ui/navigation · Navegación entre vistas del trabajador (bottom-bar / sidebar).
 */

import { navItems, views } from '../core/dom.js';
import { state } from '../core/state.js';
import { filterClientCards } from '../features/clients/directory.js';
import { renderRouteBuilder } from '../features/daily-route/daily-route.js';
import { renderClientMap } from '../features/admin/client-map.js';

export function showView(viewId) {
  if ((viewId === 'ruta-diaria' || viewId === 'mapa') && state.userRole !== 'worker') return;
  if (!document.getElementById(viewId)) return;
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  navItems.forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
  document.querySelector('[data-back]').addEventListener('click', () => showView(state.previousView));
}
