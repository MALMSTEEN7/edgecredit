/**
 * domain/route-day · Movimientos de la ruta que aún no entran a un cierre: cartulinas canceladas y
 * préstamos entregados. Igual que los abonos, se acumulan desde el último «Verificar y cerrar
 * ruta» (aunque pasen varios días sin cerrar, p. ej. rutas que se pasan un día de por medio) y
 * vuelven a cero al cerrar.
 */

import { closureCutoff, isSinceClosure } from './ledger.js';
import { personKey } from './person-cards.js';
import { localDateISO } from '../shared/dates.js';

/** Día en que se entregó la plata de la cartulina (si se creó un domingo, ese domingo). */
export function deliveryDate(client) {
  return client.deliveredOn || client.insuranceCollectedAt || client.creditStartDate || '';
}

/** Abono con que se canceló la cartulina: el más reciente (por fecha y hora de registro). */
export function finalPayment(client) {
  return (client.payments || []).reduce((last, payment) => {
    if (!last) return payment;
    const newer = String(payment.date).localeCompare(String(last.date)) || String(payment.at || '').localeCompare(String(last.at || ''));
    return newer > 0 ? payment : last;
  }, null);
}

/** Hora en que quedó cancelada: la del abono final de ese día (0 si no se registró). */
function settledTs(client) {
  const last = finalPayment(client);
  return last && last.date === client.settledAt && last.at ? Date.parse(last.at) || 0 : 0;
}

/**
 * Cartulinas canceladas de la ruta: entre `from` y `to` (fechas ISO, inclusivas) o, sin rango,
 * las canceladas desde el último cierre. Cada una con el total de la cartulina y el abono final.
 */
export function cancelledCards(clients, routeId, route, range = null, today = localDateISO()) {
  const cutoff = range ? null : closureCutoff(route);
  return Object.entries(clients)
    .filter(([, client]) => client?.route === routeId && Number(client.balance) <= 0 && client.settledAt)
    .filter(([, client]) => range ? client.settledAt >= range.from && client.settledAt <= range.to : isSinceClosure(client.settledAt, settledTs(client), cutoff, today))
    .map(([clientId, client]) => {
      const last = finalPayment(client);
      return { clientId, name: client.name, amount: Number(client.total) || 0, date: client.settledAt, finalPayment: last && last.date === client.settledAt ? Number(last.amount) || 0 : 0 };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** Suma de los abonos con que se cancelaron las cartulinas desde el último cierre. */
export function cancelledSinceClosureTotal(clients, routeId, route, today = localDateISO()) {
  const cards = cancelledCards(clients, routeId, route, null, today);
  return { count: cards.length, total: cards.reduce((sum, card) => sum + card.finalPayment, 0) };
}

/**
 * Préstamos entregados en la ruta: cartulinas nuevas (alta, renovación u otra cartulina) y
 * retanqueos. Con `date` solo los de ese día; sin `date`, los entregados desde el último cierre.
 * Es «nuevo» solo si la persona nunca antes había tenido una cartulina en el sistema.
 */
export function deliveredLoans(clients, routeId, route, date = null, today = localDateISO()) {
  const cutoff = date ? null : closureCutoff(route);
  const counts = (day, ts) => date ? day === date : isSinceClosure(day, ts, cutoff, today);
  const all = Object.entries(clients).filter(([, client]) => client);
  const loans = [];
  all.forEach(([clientId, client]) => {
    if (client.route !== routeId || client.importedFrom?.cancelledCard) return;
    const delivered = deliveryDate(client);
    if (counts(delivered, Number(client.insuranceCollectedTs) || 0)) {
      const key = personKey(client.id);
      const before = all.some(([otherId, other]) => otherId !== clientId && personKey(other.id) === key
        && (deliveryDate(other) < delivered || (deliveryDate(other) === delivered && otherId < clientId)));
      const isNew = !before && !client.renewedFrom;
      loans.push({ clientId, name: client.name, principal: Number(client.principal) || 0, amount: Number(client.total) || 0, isNew, date: delivered, kind: isNew ? 'Cliente nuevo' : client.renewedFrom ? 'Renovación' : 'Cliente que ya había estado' });
    }
    (client.restructures || []).filter(entry => entry.type === 'retanqueo' && counts(entry.date, Date.parse(entry.at || '') || 0)).forEach(entry => {
      loans.push({ clientId, name: client.name, principal: Number(entry.extra) || 0, amount: (Number(entry.extra) || 0) + (Number(entry.interest) || 0), isNew: false, date: entry.date, kind: 'Retanqueo' });
    });
  });
  return loans.sort((a, b) => a.name.localeCompare(b.name));
}
