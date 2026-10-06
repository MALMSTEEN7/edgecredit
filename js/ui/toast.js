/**
 * ui/toast · Notificaciones breves no bloqueantes.
 */

import { appToast } from '../core/dom.js';

export function showToast(message) {
  appToast.textContent = message;
  appToast.hidden = false;
  appToast.classList.add('is-visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    appToast.classList.remove('is-visible');
    appToast.hidden = true;
  }, 3200);
}
