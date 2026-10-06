/**
 * shared/dates · Utilidades de fecha local (ISO yyyy-mm-dd). Funciones puras.
 */

export function daysUntil(dateValue) {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / 86400000);
}

export function localDateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function dayDifference(from, to) {
  return Math.floor((localDate(to) - localDate(from)) / 86400000);
}

export function shiftDateISO(date, amount) {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + amount);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}
