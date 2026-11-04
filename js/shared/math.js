/**
 * shared/math · Reparto de montos y reordenamiento de listas. Funciones puras.
 */

/**
 * Redondea a miles de pesos: 22.300 → 22.000 y 22.600 → 23.000 (desde 500 sube). Montos
 * menores a 1.000 se dejan como están para no quedar en cero.
 */
export function roundToThousand(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) < 1000) return Math.round(amount);
  return Math.round(amount / 1000) * 1000;
}

export function distributeAmount(total, count, index) {
  const base = Math.floor(total / count);
  return base + (index < total % count ? 1 : 0);
}

export function moveId(order, clientId, beforeId) {
  const next = order.filter(id => id !== clientId);
  const index = beforeId ? next.indexOf(beforeId) : -1;
  next.splice(index < 0 ? next.length : index, 0, clientId);
  return next;
}
