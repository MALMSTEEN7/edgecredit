/**
 * domain/person-cards · Varias cartulinas a nombre de una misma persona.
 *
 * Cada cartulina sigue siendo un registro independiente en `clients` (su propio saldo,
 * cuota, calendario y abonos). Lo que las agrupa es la cédula de la persona. Así el
 * cobrador ve y cobra cada cartulina por separado, y la ficha permite saltar entre ellas.
 */

/** Máximo de cartulinas ACTIVAS (con saldo) que puede tener una misma persona. */
export const MAX_ACTIVE_CARDS_PER_PERSON = 4;

export function personKey(idNumber) {
  const raw = String(idNumber ?? '').trim();
  return raw.replace(/\D/g, '') || raw.toLocaleLowerCase('es');
}

/** Todas las cartulinas de la persona (activas, canceladas y renovadas), de la más antigua a la más reciente. */
export function personCardIds(clients, idNumber) {
  const key = personKey(idNumber);
  if (!key) return [];
  return Object.keys(clients)
    .filter(id => clients[id] && personKey(clients[id].id) === key)
    .sort((a, b) => String(clients[a].creditStartDate || '').localeCompare(String(clients[b].creditStartDate || '')) || a.localeCompare(b));
}

/**
 * Veces que se le ha prestado a la persona: cada cartulina a su nombre (activas, canceladas
 * o renovadas) más cada retanqueo. Devuelve { total, cards, retanqueos }.
 */
export function loanCount(clients, idNumber) {
  const ids = personCardIds(clients, idNumber);
  const retanqueos = ids.reduce((sum, id) => sum + (clients[id].restructures || []).filter(entry => entry.type === 'retanqueo').length, 0);
  return { total: ids.length + retanqueos, cards: ids.length, retanqueos };
}

/** Texto del contador: «3 préstamos» o «3 préstamos (1 retanqueo)». */
export function loanCountLabel(count) {
  const base = `${count.total} préstamo${count.total === 1 ? '' : 's'}`;
  return count.retanqueos ? `${base} (${count.retanqueos} retanqueo${count.retanqueos === 1 ? '' : 's'})` : base;
}

export function isActiveCard(client) {
  return Number(client?.balance) > 0;
}

export function activeCardIds(clients, idNumber) {
  return personCardIds(clients, idNumber).filter(id => isActiveCard(clients[id]));
}

/** Número de la cartulina dentro de la persona (1, 2, 3…), o 0 si no la encuentra. */
export function cardNumber(clients, clientId) {
  return personCardIds(clients, clients[clientId]?.id).indexOf(clientId) + 1;
}

/** ¿Se puede abrir otra cartulina simultánea para esta persona? */
export function canAddCard(clients, idNumber) {
  return activeCardIds(clients, idNumber).length < MAX_ACTIVE_CARDS_PER_PERSON;
}
