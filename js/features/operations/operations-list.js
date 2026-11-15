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
import { cancelledCards, deliveredLoans } from '../../domain/route-day.js';

// Rango de fechas para el listado 'range-cancelled' (p. ej. tarjetas canceladas de una semana).
let activeRange = null;

function operationRoute() {
  return state.userRole === 'admin' ? routeSelect.value : state.workerRoute;
}

export function renderOperationsModal() {
  const routeId = operationRoute();
  const route = routeSettlements[routeId];
  if (!route) return;
  const today = localDateISO();
  const yesterday = shiftDateISO(today, -1);
  const list = state.activeOperationList;
  const isCancelledList = ['cancelled', 'yesterday-cancelled', 'range-cancelled'].includes(list);
  // Canceladas y préstamos: los que aún no entran a un cierre (se acumulan hasta «Verificar y cerrar
  // ruta», aunque pasen varios días). «Canceladas ayer»: las del día anterior. Préstamos nuevos: solo
  // personas que entran por primera vez; ingresados: todos (nuevos y de clientes que ya habían estado).
  const entries = list === 'cancelled' ? cancelledCards(clients, routeId, route)
    : list === 'yesterday-cancelled' ? cancelledCards(clients, routeId, route, { from: yesterday, to: yesterday })
      : list === 'range-cancelled' && activeRange ? cancelledCards(clients, routeId, route, activeRange)
        : list === 'new' ? deliveredLoans(clients, routeId, route).filter(loan => loan.isNew).map(loan => ({ ...loan, amount: loan.principal }))
          : deliveredLoans(clients, routeId, route);
  const term = normalizeSearch(operationsSearch.value.trim());
  const filtered = entries.filter(entry => {
    const client = clients[entry.clientId];
    return normalizeSearch(`${entry.name} ${client?.id || ''}`).includes(term);
  });
  document.querySelector('#operations-list-route').textContent = `RUTA ${route.name.toLocaleUpperCase('es')}`;
  const sinceLabel = 'desde el último cierre';
  document.querySelector('#operations-list-title').textContent = state.activeOperationList === 'range-cancelled' && activeRange ? `Tarjetas canceladas · ${activeRange.label}` : state.activeOperationList === 'yesterday-cancelled' ? `Tarjetas canceladas · ${formatDate(yesterday)}` : state.activeOperationList === 'cancelled' ? `Tarjetas canceladas · ${sinceLabel}` : state.activeOperationList === 'new' ? `Préstamos nuevos · ${sinceLabel}` : `Préstamos ingresados · ${sinceLabel}`;
  document.querySelector('#operations-results-count').textContent = `${filtered.length} de ${entries.length} registros`;
  operationsResults.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'operations-empty';
    empty.textContent = entries.length ? 'No hay resultados para esa búsqueda.' : state.activeOperationList === 'range-cancelled' ? 'No hubo tarjetas canceladas en esa semana en esta ruta.' : state.activeOperationList === 'yesterday-cancelled' ? 'No hay tarjetas canceladas el día anterior en esta ruta.' : state.activeOperationList === 'cancelled' ? 'No se han cancelado tarjetas desde el último cierre.' : state.activeOperationList === 'new' ? 'No hay préstamos a clientes nuevos desde el último cierre.' : 'No se han entregado préstamos desde el último cierre.';
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
    id.textContent = `${clients[entry.clientId]?.id ? `Cédula ${clients[entry.clientId].id}` : 'Cliente'}${isCancelledList && entry.date ? ` · cancelada el ${formatDate(entry.date)}` : ''}${isCancelledList && entry.finalPayment ? ` · último abono ${formatMoney(entry.finalPayment)}` : ''}${!isCancelledList && entry.kind ? ` · ${entry.kind}` : ''}${!isCancelledList && entry.date && entry.date !== today ? ` · ${formatDate(entry.date)}` : ''}`;
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
