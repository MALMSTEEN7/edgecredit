/**
 * domain/accounting · Efectos contables de altas, cambios de ruta y cancelaciones
 * sobre la liquidación de cada ruta.
 */

import { clients, routeSettlements } from '../core/store.js';
import { localDateISO } from '../shared/dates.js';

export function updateClientLoanAccounting(client, clientId, oldState, newState) {
  const oldRoute = routeSettlements[oldState.route];
  const newRoute = routeSettlements[newState.route];
  if (!newRoute) return;
  [oldRoute, newRoute].filter(Boolean).forEach(route => {
    route.loansEntered ||= [];
    route.loansNew ||= [];
  });
  const updateListRow = (route, listName, amount, remove = false) => {
    const list = route[listName];
    const index = list.findIndex(entry => entry.clientId === clientId);
    if (remove) {
      if (index >= 0) list.splice(index, 1);
    } else if (index >= 0) {
      list[index] = { ...list[index], name: client.name, amount };
    } else {
      list.unshift({ name: client.name, clientId, amount });
    }
  };
  const moved = oldState.route !== newState.route;
  if (moved && oldRoute) {
    oldRoute.loans = Math.max(0, Number(oldRoute.loans || 0) - oldState.principal);
    if (!client.noBaseImpact) oldRoute.base = Number(oldRoute.base || 0) + oldState.principal;
    updateListRow(oldRoute, 'loansEntered', 0, true);
    updateListRow(oldRoute, 'loansNew', 0, true);
    newRoute.loans = Number(newRoute.loans || 0) + newState.principal;
    if (!client.noBaseImpact) newRoute.base = Number(newRoute.base || 0) - newState.principal;
    updateListRow(newRoute, 'loansEntered', newState.total);
    updateListRow(newRoute, 'loansNew', newState.principal);
    return;
  }
  const delta = newState.principal - oldState.principal;
  newRoute.loans = Math.max(0, Number(newRoute.loans || 0) + delta);
  if (!client.noBaseImpact) newRoute.base = Number(newRoute.base || 0) - delta;
  updateListRow(newRoute, 'loansEntered', newState.total);
  updateListRow(newRoute, 'loansNew', newState.principal);
}

export function addCancelledCard(client, clientId, date = localDateISO()) {
  const route = routeSettlements[client.route];
  if (!route) return;
  route.cardsCancelled ||= [];
  if (!route.cardsCancelled.some(item => item.clientId === clientId)) {
    route.cardsCancelled.unshift({ name: client.name, clientId, amount: client.total, date });
  }
}

/**
 * Una tarjeta (cartulina) solo cuenta como CANCELADA cuando la deuda quedó en cero.
 * Si el saldo vuelve a ser mayor que cero (p. ej. el admin corrige o elimina un abono),
 * se retira de la lista de canceladas de su ruta.
 */
export function syncCancelledCard(client, clientId, date = localDateISO()) {
  if (!client) return;
  if (Number(client.balance) <= 0) { addCancelledCard(client, clientId, client.settledAt || date); return; }
  Object.values(routeSettlements).forEach(route => {
    if (route.cardsCancelled?.length) route.cardsCancelled = route.cardsCancelled.filter(entry => entry.clientId !== clientId);
  });
}

/** Limpia las listas: quita tarjetas cuyo cliente aún debe y agrega las saldadas que falten. */
export function normalizeCancelledCards() {
  Object.values(routeSettlements).forEach(route => {
    route.cardsCancelled = (route.cardsCancelled || []).filter(entry => {
      const client = clients[entry.clientId];
      return !client || Number(client.balance) <= 0; // cliente eliminado: se conserva el registro histórico
    });
  });
  Object.entries(clients).forEach(([clientId, client]) => { if (Number(client.balance) <= 0) addCancelledCard(client, clientId, client.settledAt || localDateISO()); });
}
