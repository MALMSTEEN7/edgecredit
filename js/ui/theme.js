/**
 * ui/theme · Tema claro/oscuro persistido por dispositivo.
 */

import { themeDescription, themeToggle } from '../core/dom.js';

export function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  themeToggle.checked = light;
  themeDescription.textContent = light ? 'Apariencia clara' : 'Apariencia oscura';
  // Interruptor equivalente en Configuración del administrador.
  const adminToggle = document.querySelector('#admin-theme-toggle');
  if (adminToggle) adminToggle.checked = light;
  const adminDescription = document.querySelector('#admin-theme-description');
  if (adminDescription) adminDescription.textContent = themeDescription.textContent;
  try { localStorage.setItem('edgecredit-theme', light ? 'light' : 'dark'); } catch { /* almacenamiento opcional */ }
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'light' : 'dark'));
}
