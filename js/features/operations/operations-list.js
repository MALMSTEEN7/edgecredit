/**
 * features/operations · Listados operativos (canceladas, préstamos ingresados/nuevos) con búsqueda.
 */

import { adminView, customModal, interestModal, modal, newClientModal, operationsModal, operationsResults, operationsSearch, routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, routeSettlements } from '../../core/store.js';
import { enterAdminDirectory, renderAdminRoute } from '../admin/admin-shell.js';
import { openClient } from '../clients/client-detail.js';
import { localDateISO, shiftDateISO } from '../../shared/dates.js';
import { formatDate, formatMoney, normalizeSearch } from '../../shared/format.js';
import { personKey } from '../../domain/person-cards.js';

// Rango de fechas para el listado 'range-cancelled' (p. ej. tarjetas canceladas de una semana).
let activeRange = null;

function operationRoute() {
  return state.userRole === 'admin' ? routeSelect.value : state.workerRoute;
}

/** Día en que se entregó la plata de la cartulina (si se creó un domingo, ese domingo). */
function deliveryDate(client) {
  return client.deliveredOn || client.insuranceCollectedAt || client.creditStartDate || '';
}

/** Cartulinas canceladas (saldo en cero) de la ruta entre `from` y `to`, la más reciente primero. */
function cancelledCards(routeId, from, to) {
  return Object.entries(clients)
    .filter(([, client]) => client?.route === routeId && Number(client.balance) <= 0 && client.settledAt && client.settledAt >= from && client.settledAt <= to)
    .map(([clientId, client]) => ({ clientId, name: client.name, amount: Number(client.total) || 0, date: client.settledAt }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/**
 * Préstamos entregados en la ruta en `date`: cartulinas nuevas (alta, renovación u otra
 * cartulina) y retanqueos. Es «nuevo» solo si la persona nunca antes había tenido una
 * cartulina en el sistema; los demás son de clientes que ya habían estado.
 */
function loansOn(routeId, date) {
  const all = Object.entries(clients).filter(([, client]) => client);
  const loans = [];
  all.forEach(([clientId, client]) => {
    if (client.route !== routeId || client.importedFrom?.cancelledCard) return;
    if (deliveryDate(client) === date) {
      const key = personKey(client.id);
      const before = all.some(([otherId, other]) => otherId !== clientId && personKey(other.id) === key
        && (deliveryDate(other) < date || (deliveryDate(other) === date && otherId < clientId)));
      const isNew = !before && !client.renewedFrom;
      loans.push({ clientId, name: client.name, principal: Number(client.principal) || 0, amount: Number(client.total) || 0, isNew, kind: isNew ? 'Cliente nuevo' : client.renewedFrom ? 'Renovación' : 'Cliente que ya había estado' });
    }
    (client.restructures || []).filter(entry => entry.type === 'retanqueo' && entry.date === date).forEach(entry => {
      loans.push({ clientId, name: client.name, principal: Number(entry.extra) || 0, amount: (Number(entry.extra) || 0) + (Number(entry.interest) || 0), isNew: false, kind: 'Retanqueo' });
    });
  });
  return loans.sort((a, b) => a.name.localeCompare(b.name));
}

export function renderOperationsModal() {
  const routeId = operationRoute();
  const route = routeSettlements[routeId];
  if (!route) return;
  const today = localDateISO();
  const yesterday = shiftDateISO(today, -1);
  const list = state.activeOperationList;
  const isCancelledList = ['cancelled', 'yesterday-cancelled', 'range-cancelled'].includes(list);
  // Canceladas: las de hoy; «Canceladas ayer»: las del día anterior. Préstamos nuevos: solo personas
  // que entran por primera vez; ingresados: todos los préstamos del día (nuevos y de clientes que ya habían estado).
  const entries = list === 'cancelled' ? cancelledCards(routeId, today, today)
    : list === 'yesterday-cancelled' ? cancelledCards(routeId, yesterday, yesterday)
      : list === 'range-cancelled' && activeRange ? cancelledCards(routeId, activeRange.from, activeRange.to)
        : list === 'new' ? loansOn(routeId, today).filter(loan => loan.isNew).map(loan => ({ ...loan, amount: loan.principal }))
          : loansOn(routeId, today);
  const term = normalizeSearch(operationsSearch.value.trim());
  const filtered = entries.filter(entry => {
    const client = clients[entry.clientId];
    return normalizeSearch(`${entry.name} ${client?.id || ''}`).includes(term);
  });
  document.querySelector('#operations-list-route').textContent = `RUTA ${route.name.toLocaleUpperCase('es')}`;
  document.querySelector('#operations-list-title').textContent = state.activeOperationList === 'range-cancelled' && activeRange ? `Tarjetas canceladas · ${activeRange.label}` : state.activeOperationList === 'yesterday-cancelled' ? `Tarjetas canceladas · ${formatDate(yesterday)}` : state.activeOperationList === 'cancelled' ? `Tarjetas canceladas · hoy ${formatDate(today)}` : state.activeOperationList === 'new' ? `Préstamos nuevos · hoy ${formatDate(today)}` : `Préstamos ingresados · hoy ${formatDate(today)}`;
  document.querySelector('#operations-results-count').textContent = `${filtered.length} de ${entries.length} registros`;
  operationsResults.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'operations-empty';
    empty.textContent = entries.length ? 'No hay resultados para esa búsqueda.' : state.activeOperationList === 'range-cancelled' ? 'No hubo tarjetas canceladas en esa semana en esta ruta.' : state.activeOperationList === 'yesterday-cancelled' ? 'No hay tarjetas canceladas el día anterior en esta ruta.' : state.activeOperationList === 'cancelled' ? 'Hoy no se han cancelado tarjetas en esta ruta.' : state.activeOperationList === 'new' ? 'Hoy no hay préstamos a clientes nuevos en esta ruta.' : 'Hoy no se han entregado préstamos en esta ruta.';
    operationsResults.append(empty);
    return;
  }
  filtered.forEach((entry, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'operations-result-row';
    row.dataset.opsClient = entry.clientId || '';
    row.dataset.opsIndex = String(index);
    const customer = document.createElement('span');
    customer.className = 'operations-result-customer';
    const name = document.createElement('strong');
    name.textContent = entry.name;
    const id = document.createElement('small');
    id.textContent = `${clients[entry.clientId]?.id ? `Cédula ${clients[entry.clientId].id}` : 'Cliente'}${isCancelledList && entry.date ? ` · cancelada el ${formatDate(entry.date)}` : ''}${!isCancelledList && entry.kind ? ` · ${entry.kind}` : ''}`;
    customer.append(name, id);
    const amount = document.createElement('strong');
    amount.className = 'operations-result-amount';
    amount.textContent = formatMoney(entry.amount);
    row.append(customer, amount, Object.assign(document.createElement('span'), { className: 'row-chevron', textContent: '›', ariaHidden: true }));
    operationsResults.append(row);
  });
}

/** Abre un listado. Para 'range-cancelled' recibe { from, to, label } (fechas ISO, inclusivas). */
export function openOperationsList(type, range = null) {
  state.activeOperationList = ['cancelled', 'new', 'yesterday-cancelled', 'range-cancelled'].includes(type) ? type : 'entered';
  activeRange = type === 'range-cancelled' ? range : null;
  operationsSearch.value = '';
  renderOperationsModal();
  operationsModal.hidden = false;
  document.body.classList.add('modal-open');
  operationsSearch.focus();
}

function closeOperationsList() {
  operationsModal.hidden = true;
  if (customModal.hidden && modal.hidden && newClientModal.hidden && interestModal.hidden) document.body.classList.remove('modal-open');
}

export function openOperationsClient(clientId) {
  if (!clients[clientId]) return;
  if (state.userRole === 'admin' && !adminView.hidden) {
    routeSelect.value = clients[clientId].route;
    renderAdminRoute(routeSelect.value);
    enterAdminDirectory();
  }
  openClient(clientId);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelectorAll('[data-operation-list]').forEach(button => button.addEventListener('click', () => openOperationsList(button.dataset.operationList)));
  operationsSearch.addEventListener('input', renderOperationsModal);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !operationsModal.hidden) closeOperationsList(); });
  operationsModal.addEventListener('click', event => {
    if (event.target === operationsModal || event.target.closest('[data-close-operations-list]')) closeOperationsList();
    const row = event.target.closest('.operations-result-row[data-ops-client]');
    if (row?.dataset.opsClient && clients[row.dataset.opsClient]) {
      closeOperationsList();
      openOperationsClient(row.dataset.opsClient);
    }
  });
}
