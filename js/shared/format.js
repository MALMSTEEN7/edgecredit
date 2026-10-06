/**
 * shared/format · Formateo y normalización de texto, dinero y colores. Funciones puras.
 */

export const formatMoney = value => '$ ' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);

export const routeKey = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, '-');

export const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function blendColor(from, to, amount) {
  const a = from.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16));
  const b = to.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16));
  return `#${a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
