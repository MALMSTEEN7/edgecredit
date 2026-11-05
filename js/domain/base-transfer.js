/**
 * domain/base-transfer · Traspasos de base entre cobros.
 *
 * Los cobros se prestan base entre ellos (p. ej. Don Matías le da $ 200.000 a Cerrito). El
 * trabajador lo registra desde «Tu base hoy»: a su cobro se le resta en el acto y queda una
 * solicitud «base-transfer» en Pendientes para que el admin la revise.
 *
 * El trabajador solo puede escribir en su propio cobro, así que el abono al cobro de destino lo
 * hace el dispositivo del admin (applyPendingBaseTransfers, al recibir la solicitud). Cada cobro
 * guarda los traspasos que recibió (`baseTransfersIn`) y los que envió (`baseTransfersOut`) con
 * el id de la solicitud: así ninguno se cuenta dos veces aunque el admin tenga la app abierta
 * en dos equipos, y queda la trazabilidad de cada movimiento.
 */

export const EXTERNAL_ROUTE = '__external__';

const nowISO = () => new Date().toISOString();

/** El trabajador envía base: se resta de su cobro y se crea la solicitud para el admin. */
export function createBaseTransfer({ origin, originId, toId, toName, amount, worker, comment = '' }) {
  const id = `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const at = nowISO();
  const value = Math.round(Number(amount) || 0);
  origin.base = Number(origin.base || 0) - value;
  origin.baseTransfersOut ||= [];
  origin.baseTransfersOut.push({ id, amount: value, to: toId, toName, at });
  return {
    id, type: 'base-transfer', routeId: originId, route: origin.name || originId,
    toRouteId: toId, toRouteName: toName, amount: value, comment: String(comment || '').trim(),
    workerId: worker?.id || '', workerName: worker?.name || 'Trabajador',
    clientName: '', createdAt: at, status: 'pending', appliedTo: null, appliedAt: null,
  };
}

/** Suma el traspaso a la base del cobro de destino (una sola vez). */
export function creditDestination(request, routes) {
  const toId = request.toRouteId;
  const dest = routes[toId];
  if (!toId || toId === EXTERNAL_ROUTE || !dest) return false;
  dest.baseTransfersIn ||= [];
  if (!dest.baseTransfersIn.some(entry => entry.id === request.id)) {
    dest.base = Number(dest.base || 0) + Number(request.amount || 0);
    dest.baseTransfersIn.push({ id: request.id, amount: Number(request.amount || 0), from: request.routeId, fromName: request.route, at: nowISO() });
  }
  request.appliedTo = toId;
  request.appliedAt ||= nowISO();
  return true;
}

/** Quita el traspaso del cobro que lo había recibido (para cambiar el destino o anularlo). */
function debitDestination(request, routes) {
  const dest = routes[request.appliedTo];
  if (dest?.baseTransfersIn?.some(entry => entry.id === request.id)) {
    dest.base = Number(dest.base || 0) - Number(request.amount || 0);
    dest.baseTransfersIn = dest.baseTransfersIn.filter(entry => entry.id !== request.id);
  }
  request.appliedTo = null;
  request.appliedAt = null;
}

/** El admin corrige a qué cobro iba el dinero. */
export function retargetBaseTransfer(request, routes, toId, toName) {
  debitDestination(request, routes);
  request.toRouteId = toId;
  request.toRouteName = toName;
  const origin = routes[request.routeId];
  const out = origin?.baseTransfersOut?.find(entry => entry.id === request.id);
  if (out) { out.to = toId; out.toName = toName; }
  creditDestination(request, routes);
}

/** El admin anula el traspaso: el dinero vuelve al cobro que lo envió. */
export function cancelBaseTransfer(request, routes) {
  debitDestination(request, routes);
  const origin = routes[request.routeId];
  if (origin?.baseTransfersOut?.some(entry => entry.id === request.id)) {
    origin.base = Number(origin.base || 0) + Number(request.amount || 0);
    origin.baseTransfersOut = origin.baseTransfersOut.filter(entry => entry.id !== request.id);
  }
  request.status = 'rejected';
  request.resolvedAt = nowISO();
}

/**
 * Admin: acredita en su destino los traspasos que aún no se han aplicado. Devuelve true si
 * cambió algo (para guardar).
 */
export function applyPendingBaseTransfers(requests, routes) {
  let changed = false;
  requests.forEach(request => {
    if (request?.type !== 'base-transfer' || request.status === 'rejected') return;
    if (!request.toRouteId || request.toRouteId === EXTERNAL_ROUTE || request.appliedTo === request.toRouteId) return;
    if (creditDestination(request, routes)) changed = true;
  });
  return changed;
}

/**
 * Traspasos que movieron la base de un cobro después de un momento dado (ms): lo recibido menos
 * lo enviado. Sirve para no perderlos cuando la base del día siguiente se recalcula del cierre.
 */
export function baseTransfersSince(route, sinceTs) {
  const after = entry => (Date.parse(entry.at) || 0) > sinceTs;
  const received = (route?.baseTransfersIn || []).filter(after).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const sent = (route?.baseTransfersOut || []).filter(after).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  return received - sent;
}
