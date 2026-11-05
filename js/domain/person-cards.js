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

/**
 * ¿Las dos cadenas son iguales o difieren en un solo carácter (uno de más, uno de menos o uno
 * cambiado)? Sirve para detectar a una persona ya registrada aunque se escriba con un número o
 * una letra de diferencia.
 */
export function withinOneEdit(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  // Dos caracteres seguidos volteados (80513497 por 80513479) también cuentan como un error.
  if (a.length === b.length) {
    const diff = [...a].map((char, index) => (char === b[index] ? -1 : index)).filter(index => index >= 0);
    if (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
  }
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
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

/**
 * Nombre de la cartulina para mostrar junto al cliente. Se numeran solo las ACTIVAS (las
 * canceladas no ocupan número): «Cartulina 2». Vacío si la persona tiene una sola activa;
 * «Cartulina cancelada» si esta ya no tiene saldo y la persona tiene otras.
 */
export function cardLabel(clients, clientId) {
  const client = clients[clientId];
  if (!client) return '';
  const active = activeCardIds(clients, client.id);
  if (!isActiveCard(client)) return personCardIds(clients, client.id).length > 1 ? 'Cartulina cancelada' : '';
  return active.length > 1 ? `Cartulina ${active.indexOf(clientId) + 1}` : '';
}

/** ¿Se puede abrir otra cartulina simultánea para esta persona? */
export function canAddCard(clients, idNumber) {
  return activeCardIds(clients, idNumber).length < MAX_ACTIVE_CARDS_PER_PERSON;
}

// ── Número de préstamo e historial de préstamos ──
//
// Las cartulinas importadas traen `loanHistory` con los préstamos que la persona tuvo en el
// sistema anterior ({ source, asOf, total, loans: [{ n, amount, start, end, days, active, code }] })
// y la cartulina activa trae su número en `loanNumber` (p. ej. el préstamo #30 de la persona).
// Las cartulinas que se crean después en EdgeCredit siguen la cuenta: #31, #32…

/** Historial del sistema anterior de la persona (el más completo entre sus cartulinas), o null. */
export function personLoanHistory(clients, idNumber) {
  return personCardIds(clients, idNumber)
    .map(id => clients[id]?.loanHistory)
    .filter(validHistory)
    .sort((a, b) => Number(b.total || b.loans.length) - Number(a.total || a.loans.length))[0] || null;
}

const validHistory = history => Array.isArray(history?.loans) && history.loans.length > 0;
const startOf = client => String(client?.creditStartDate || '');

/** Historial que aplica a esta cartulina: el suyo propio o, si no trae, el de la persona. */
export function cardLoanHistory(clients, clientId) {
  const client = clients[clientId];
  if (!client) return null;
  return validHistory(client.loanHistory) ? client.loanHistory : personLoanHistory(clients, client.id);
}

/**
 * Cartulinas que comparten la historia de esta: las de la misma cédula cuyo historial es el mismo
 * (o que no traen historial, como las creadas en EdgeCredit). Así dos personas distintas que el
 * sistema anterior registró con códigos parecidos no se mezclan.
 */
function relatedCardIds(clients, clientId, history) {
  const ids = personCardIds(clients, clients[clientId].id);
  if (!history) return ids;
  return ids.filter(id => {
    const own = clients[id].loanHistory;
    return id === clientId || !validHistory(own) || (own.source === history.source && own.name === history.name);
  });
}

/** Número del préstamo de esta cartulina dentro de la historia de la persona (#1, #2…). */
export function loanNumber(clients, clientId) {
  const client = clients[clientId];
  if (!client) return 0;
  if (Number(client.loanNumber) > 0) return Number(client.loanNumber);
  const history = cardLoanHistory(clients, clientId);
  const ids = relatedCardIds(clients, clientId, history);
  if (!history) return Math.max(1, ids.indexOf(clientId) + 1);
  // Las que no traen número (creadas en EdgeCredit) siguen después del último del sistema anterior.
  const base = Math.max(Number(history.total) || 0, ...history.loans.map(loan => Number(loan.n) || 0));
  const later = ids.filter(id => !(Number(clients[id].loanNumber) > 0))
    .sort((a, b) => startOf(clients[a]).localeCompare(startOf(clients[b])) || a.localeCompare(b));
  return base + later.indexOf(clientId) + 1;
}

/** Cuántos préstamos lleva la persona en total (sistema anterior + EdgeCredit). */
export function personLoanTotal(clients, clientId) {
  const client = clients[clientId];
  if (!client) return 0;
  const history = cardLoanHistory(clients, clientId);
  const ids = relatedCardIds(clients, clientId, history);
  const historyTotal = history ? Math.max(Number(history.total) || 0, history.loans.length) : 0;
  return Math.max(historyTotal, ids.length, ...ids.map(id => loanNumber(clients, id)));
}

/**
 * Todos los préstamos de la persona, del más reciente al más antiguo: los del sistema anterior y
 * las cartulinas de EdgeCredit. `current` marca el de la cartulina que se está viendo.
 */
export function loanTimeline(clients, clientId) {
  const client = clients[clientId];
  if (!client) return [];
  const history = cardLoanHistory(clients, clientId);
  const rows = new Map();
  (history?.loans || []).forEach(loan => rows.set(Number(loan.n), { ...loan, n: Number(loan.n), source: 'legacy' }));
  relatedCardIds(clients, clientId, history).forEach(id => {
    const card = clients[id];
    const n = loanNumber(clients, id);
    const settled = Number(card.balance) <= 0;
    const fromHistory = rows.get(n);
    rows.set(n, {
      ...(fromHistory || {}),
      n,
      amount: Number(card.principal) || Number(fromHistory?.amount) || Number(card.total) || 0,
      start: startOf(card) || fromHistory?.start || '',
      end: settled ? (card.settledAt || fromHistory?.end || '') : null,
      active: !settled,
      clientId: id,
      current: id === clientId,
      source: fromHistory ? 'legacy' : 'edgecredit',
    });
  });
  return [...rows.values()].sort((a, b) => b.n - a.n);
}
