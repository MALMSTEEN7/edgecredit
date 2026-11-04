/**
 * domain/portfolio · Cartera de un cobro: el dinero que aún está en la calle.
 *
 * - Cartera = la suma de lo que deben las cartulinas activas (saldo), que ya incluye los
 *   intereses que faltan por cobrar. Se separa en capital e intereses en la misma proporción
 *   del préstamo (si prestó 100 y debe pagar 120, de cada peso que falta 1/6 es interés).
 * - Clavo = cartulina con saldo que no ha abonado nada en más de N meses (desde su último
 *   abono, o desde la entrega si nunca abonó). N lo elige el admin (2 meses por defecto) y se
 *   recuerda en este dispositivo; lo usan Reportes › Cartera y el filtro del Directorio.
 */

import { localDateISO } from '../shared/dates.js';

export const CLAVO_MONTH_OPTIONS = [2, 3, 6, 12];
const CLAVO_KEY = 'edgecredit-clavo-months';

export function clavoMonths() {
  try {
    const value = Number(localStorage.getItem(CLAVO_KEY));
    return CLAVO_MONTH_OPTIONS.includes(value) ? value : 2;
  } catch { return 2; }
}

export function setClavoMonths(months) {
  try { localStorage.setItem(CLAVO_KEY, String(months)); } catch { /* opcional */ }
}

/** Último abono (fecha) o, si nunca abonó, la fecha de entrega del crédito. */
export function lastPaymentDate(client) {
  const last = (client?.payments || [])
    .filter(payment => Number(payment.amount) > 0 && payment.date)
    .map(payment => String(payment.date))
    .sort()
    .at(-1);
  return last || client?.lastPaymentDate || client?.creditStartDate || '';
}

/** Fecha límite: quien no abona desde antes de esta fecha es clavo. */
export function clavoCutoff(months = clavoMonths(), today = localDateISO()) {
  const [year, month, day] = today.split('-').map(Number);
  const cutoff = new Date(year, month - 1 - months, day);
  return localDateISO(cutoff);
}

export function isClavo(client, months = clavoMonths(), today = localDateISO()) {
  if (!client || Number(client.balance) <= 0) return false;
  const last = lastPaymentDate(client);
  return Boolean(last) && last < clavoCutoff(months, today);
}

/** Días desde el último abono (o desde la entrega). */
export function daysWithoutPayment(client, today = localDateISO()) {
  const last = lastPaymentDate(client);
  if (!last) return null;
  return Math.max(0, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${last}T12:00:00`)) / 86400000));
}

/** Parte del saldo que es interés (proporción del préstamo) y parte que es capital. */
function splitBalance(client) {
  const balance = Math.max(0, Number(client.balance) || 0);
  const total = Number(client.total) || 0;
  const principal = Number(client.principal) || 0;
  const share = total > 0 && principal > 0 && total > principal ? (total - principal) / total : 0;
  const interest = Math.round(balance * share);
  return { balance, interest, capital: balance - interest };
}

/**
 * Cartera del cobro: totales de todas las cartulinas activas y de los clavos, y una fila por
 * cartulina (de la que más debe a la que menos).
 */
export function routePortfolio(clients, routeId, { months = clavoMonths(), today = localDateISO() } = {}) {
  const empty = () => ({ balance: 0, capital: 0, interest: 0, count: 0 });
  const all = empty();
  const clavos = empty();
  const rows = [];
  Object.entries(clients).forEach(([id, client]) => {
    if (!client || client.route !== routeId || Number(client.balance) <= 0) return;
    const part = splitBalance(client);
    const clavo = isClavo(client, months, today);
    [all, ...(clavo ? [clavos] : [])].forEach(sum => {
      sum.balance += part.balance;
      sum.capital += part.capital;
      sum.interest += part.interest;
      sum.count += 1;
    });
    rows.push({ id, client, ...part, clavo, last: lastPaymentDate(client), days: daysWithoutPayment(client, today) });
  });
  rows.sort((a, b) => b.balance - a.balance || String(a.client.name).localeCompare(String(b.client.name), 'es'));
  return { all, clavos, rows, months };
}
