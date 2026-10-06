/**
 * shared/math · Reparto de montos y reordenamiento de listas. Funciones puras.
 */

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
