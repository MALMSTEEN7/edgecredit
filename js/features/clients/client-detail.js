/**
 * features/clients/client-detail · Ficha del cliente: saldo, progreso, historial
 * de abonos e intereses, y edición completa (solo admin).
 */

import { paymentFrequencyDays, paymentFrequencyLabels } from '../../core/config.js';
import { creditDetails, customModalError, disclosureButton, interestToggle, routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, ensureRoute, expandedPaymentHistory, pendingRequests, persistBusinessData, routeSettlements } from '../../core/store.js';
import { syncCancelledCard, updateClientLoanAccounting } from '../../domain/accounting.js';
import { balancesAfterPayments, creditDay, inferClientPrincipal, paidPercent, paymentCycleIndex, startDateForCreditDay, paymentBehavior, paymentHistory, rememberWorstHistory, updatePaidAmountTotal } from '../../domain/loan-schedule.js';
import { renderAdminRoute } from '../admin/admin-shell.js';
import { filterClientCards, removeClient, renderClientRows, setClientAvatar } from './directory.js';
import { localDateISO } from '../../shared/dates.js';
import { formatDate, formatMoney, routeKey } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showView } from '../../ui/navigation.js';
import { showToast } from '../../ui/toast.js';
import { bindImageViewer } from '../../ui/image-viewer.js';
import { LOCATION_FAILURE_LABELS, hasCoordinates, isApproximateLocation, locateDevice } from '../../shared/geo.js';
import { clientInsurance, generalInsuranceAmount, resolveInsurance } from '../../domain/insurance.js';
import { canRenew, onClientRenewed } from './new-client.js';
import { MAX_ACTIVE_CARDS_PER_PERSON, activeCardIds, canAddCard, loanCount, loanCountLabel } from '../../domain/person-cards.js';
import { PAYDAY_OPTIONS, cardColor, paintCardColorBand, shiftDays, startDateForPayday, weekdayOf } from '../../domain/card-color.js';
import { FINANCE_INTEREST_PERCENT, GENERAL_RETANQUEO, RETANQUEO_INTEREST_PERCENT, financeCard, pendingRestructure, percentOrAmount, recordRetanqueoInRoute, retanqueoCard } from '../../domain/restructure.js';

/** Dentro de la ficha: la «cicatriz» del historial de pagos de la cartulina. */
function updatePaymentBehaviorUI(client) {
  const indicator = document.querySelector('#payment-behavior-indicator');
  rememberWorstHistory(client);
  const history = paymentHistory(client);
  indicator.style.setProperty('--behavior-color', history.color);
  indicator.classList.toggle('has-warning', history.level !== 'good');
  indicator.dataset.history = history.level;
  indicator.querySelector('span').textContent = history.label;
  indicator.title = history.level === 'good' ? history.detail : `${history.detail} La marca se conserva aunque la cartulina quede pagada.`;
}

export function refreshClientBalance() {
  const total = clients[state.activeClient].balance;
  document.querySelector('#detail-balance').textContent = formatMoney(total);
  document.querySelector('#detail-balance-copy').textContent = formatMoney(total);
}

function createMethodIcon(method) {
  const transfer = method === 'transfer';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', transfer ? 'M4 8h15l-3-3m4 11H5l3 3' : 'M3 6.5h18v11H3z M6 10h.01 M18 14h.01 M10 12h4');
  svg.append(path);
  const icon = document.createElement('span');
  icon.className = `payment-method-indicator ${transfer ? 'is-transfer' : 'is-cash'}`;
  icon.title = transfer ? 'Transferencia' : 'Efectivo';
  icon.setAttribute('aria-label', transfer ? 'Transferencia' : 'Efectivo');
  const label = document.createElement('span');
  label.textContent = transfer ? 'Transf.' : 'Efectivo';
  icon.append(svg, label);
  return icon;
}

/** Fecha corta del historial, como en la tarjeta de la ruta diaria: «24-oct-26». */
function shortHistoryDate(iso) {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  if (!year) return '—';
  const name = new Date(year, month - 1, day).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
  return `${String(day).padStart(2, '0')}-${name}-${String(year).slice(-2)}`;
}

export function renderHistory(client) {
  const paymentsList = document.querySelector('#payment-history-list');
  paymentsList.replaceChildren();
  client.payments ||= [];
  const isExpanded = expandedPaymentHistory.has(state.activeClient);
  const paymentsToRender = isExpanded ? client.payments : client.payments.slice(0, 3);
  const balances = balancesAfterPayments(client);
  paymentsToRender.forEach((payment, paymentIndex) => {
    const row = document.createElement('li');
    const dateAndMethod = document.createElement('span');
    dateAndMethod.className = 'history-date-method';
    const date = document.createElement('time');
    date.dateTime = payment.date;
    date.textContent = shortHistoryDate(payment.date);
    date.title = formatDate(payment.date);
    dateAndMethod.append(date, createMethodIcon(payment.method));
    if (payment.method === 'transfer' && !payment.receiptData) {
      const missing = document.createElement('small');
      missing.className = 'evidence-missing';
      missing.textContent = 'Falta evidencia';
      missing.setAttribute('role', 'status');
      dateAndMethod.append(missing);
    }
    if (payment.method === 'transfer' && payment.receiptData) {
      const evidenceLink = bindImageViewer(document.createElement('button'), { src: payment.receiptData, title: `Comprobante · ${formatMoney(payment.amount)}`, caption: `${client.name} · ${formatDate(payment.date)}` });
      evidenceLink.type = 'button';
      evidenceLink.className = 'evidence-link';
      evidenceLink.textContent = 'Ver foto';
      evidenceLink.setAttribute('aria-label', `Ver comprobante del ${formatDate(payment.date)}`);
      dateAndMethod.append(evidenceLink);
    }
    // Como el historial del sistema anterior: fecha, abono y el saldo que dejó, en columnas.
    row.className = 'history-payment-row';
    const amount = document.createElement('strong');
    amount.className = 'history-payment-amount';
    amount.textContent = formatMoney(payment.amount);
    const after = document.createElement('span');
    after.className = 'history-payment-balance';
    after.textContent = formatMoney(balances[paymentIndex]);
    row.append(dateAndMethod, amount, after);
    if (state.userRole === 'admin') {
      const actions = document.createElement('span');
      actions.className = 'history-admin-actions';
      ['Editar', 'Eliminar'].forEach((label, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.paymentAction = index === 0 ? 'edit' : 'delete';
        button.dataset.paymentIndex = String(paymentIndex);
        actions.append(button);
      });
      row.append(actions);
    }
    paymentsList.append(row);
  });
  if (paymentsToRender.length) {
    const head = document.createElement('li');
    head.className = 'history-payment-head';
    head.innerHTML = '<span>Fecha</span><span>Abono</span><span>Saldo</span>';
    paymentsList.prepend(head);
  }
  document.querySelector('#payment-history-count').textContent = client.archivedPaymentsAt && !client.payments.length ? 'Archivado' : isExpanded ? `${client.payments.length} registros` : `${Math.min(client.payments.length, 3)} recientes`;
  const historyToggle = document.querySelector('#payment-history-toggle');
  historyToggle.hidden = client.payments.length <= 3;
  historyToggle.textContent = isExpanded ? 'Mostrar solo los 3 más recientes' : 'Ver historial completo';
  if (!client.payments.length && client.archivedPaymentsAt) {
    const archived = document.createElement('li');
    archived.className = 'history-empty';
    archived.textContent = 'El historial de abonos se archivó después de una semana de cancelar esta cartulina.';
    paymentsList.append(archived);
  }

  const interestList = document.querySelector('#interest-history-list');
  interestList.replaceChildren();
  if (client.interestHistory.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Aún no hay intereses aplicados.';
    interestList.append(empty);
  } else {
    client.interestHistory.forEach(entry => {
      const row = document.createElement('li');
      const date = document.createElement('time');
      date.dateTime = entry.date;
      date.textContent = formatDate(entry.date);
      const amount = document.createElement('strong');
      amount.textContent = formatMoney(entry.amount);
      row.append(date, amount);
      interestList.append(row);
    });
  }
  document.querySelector('#interest-history-count').textContent = `${client.interestHistory.length} ${client.interestHistory.length === 1 ? 'recargo' : 'recargos'}`;
  renderRetanqueoHistory(client);
}

/** Reubica los abonos en sus cuotas cuando cambia la fecha de inicio de la cartulina. */
function reassignPaymentCycles(client) {
  (client.payments || []).forEach(payment => { if (!payment.beforeRestructure) payment.cycleIndex = paymentCycleIndex(client, payment.date); });
  client.paidPeriodIndexes = [...new Set((client.payments || []).filter(payment => !payment.beforeRestructure).map(payment => payment.cycleIndex))].sort((a, b) => a - b);
}

/** Texto del color que toma una cartulina con esa frecuencia y fecha de inicio. */
function startColorLabel(frequency, startDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ''))) return 'Elige una fecha';
  const color = cardColor({ balance: 1, frequency, creditStartDate: startDate });
  const weekday = new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(new Date(`${startDate}T12:00:00`));
  if (weekdayOf(startDate) === 0) return `Domingo: no se permite (elige sábado o lunes)`;
  if (!color) return `${weekday} · las diarias no llevan color`;
  return frequency === 'weekly' ? `${color.label} · cobra los ${weekday}` : `${color.label} · inicia un ${weekday}`;
}

/** Retanqueos de la cartulina (lo prestado de más, sus intereses y seguros, y cómo cambió el saldo). */
function renderRetanqueoHistory(client) {
  const retanqueos = (client.restructures || []).filter(entry => entry.type === 'retanqueo');
  const list = document.querySelector('#retanqueo-history-list');
  list.replaceChildren();
  if (!retanqueos.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Esta cartulina no tiene retanqueos.';
    list.append(empty);
  }
  retanqueos.forEach(entry => {
    const extra = Number(entry.extra) || 0;
    const interest = Number(entry.interest) || 0;
    const row = document.createElement('li');
    const copy = document.createElement('span');
    copy.className = 'retanqueo-history-copy';
    const date = document.createElement('time');
    date.dateTime = entry.date;
    date.textContent = formatDate(entry.date);
    const detail = document.createElement('small');
    const parts = [`Intereses ${formatMoney(interest)}`, `Seguros ${formatMoney(Number(entry.insurance) || 0)}`];
    if (entry.by) parts.push(entry.by);
    detail.textContent = parts.join(' · ');
    copy.append(date, detail);
    const amount = document.createElement('strong');
    amount.textContent = `+ ${formatMoney(extra)}`;
    const after = document.createElement('small');
    after.className = 'history-balance-after';
    const before = Number(entry.before?.balance);
    after.textContent = Number.isFinite(before) ? `Saldo ${formatMoney(before)} → ${formatMoney(before + extra + interest)}` : `Suma al saldo ${formatMoney(extra + interest)}`;
    amount.append(after);
    row.append(copy, amount);
    list.append(row);
  });
  document.querySelector('#retanqueo-history-count').textContent = `${retanqueos.length} ${retanqueos.length === 1 ? 'retanqueo' : 'retanqueos'}`;
}

function updateMoratoryButton(client) {
  const overdue = state.userRole !== 'admin' && creditDay(client) >= client.totalDays;
  interestToggle.hidden = !overdue;
  interestToggle.setAttribute('aria-hidden', String(!overdue));
}

const mapsSearchUrl = address => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Dirección alternativa, enlaces al mapa e historial de direcciones anteriores. */
function renderAddressDetails(client) {
  document.querySelector('#detail-alt-address').textContent = client.altAddress || '—';
  document.querySelector('#detail-address-notes').textContent = client.addressNotes || '—';
  const altLink = document.querySelector('#client-alt-location-link');
  altLink.hidden = !client.altAddress;
  if (client.altAddress) {
    altLink.href = mapsSearchUrl(client.altAddress);
    altLink.setAttribute('aria-label', `Abrir en el mapa la dirección alternativa de ${client.name}: ${client.altAddress}`);
  }
  const history = Array.isArray(client.addressHistory) ? client.addressHistory : [];
  document.querySelector('#address-history-count').textContent = history.length ? `${history.length} ${history.length === 1 ? 'cambio' : 'cambios'}` : 'Sin cambios';
  const list = document.querySelector('#address-history-list');
  list.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Esta dirección no ha sido modificada.';
    list.append(empty);
    return;
  }
  [...history].reverse().forEach(entry => {
    const row = document.createElement('li');
    const copy = document.createElement('span');
    copy.className = 'address-history-copy';
    const kind = document.createElement('small');
    kind.textContent = entry.type === 'alternativa' ? 'Dirección alternativa' : 'Dirección principal';
    const address = document.createElement('strong');
    address.textContent = entry.address || '(sin dirección)';
    const meta = document.createElement('small');
    meta.textContent = `Reemplazada el ${new Date(entry.changedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} por ${entry.changedBy || 'Administrador'}${entry.replacedBy ? ` · nueva: ${entry.replacedBy}` : ''}`;
    copy.append(kind, address, meta);
    row.append(copy);
    list.append(row);
  });
}

/** Notas compartidas (trabajador y admin pueden editarlas). */
function renderClientNotes(client) {
  const input = document.querySelector('#client-notes-input');
  input.value = client.notes || '';
  input.dataset.saved = input.value;
  document.querySelector('#save-client-notes').disabled = true;
  document.querySelector('#client-notes-status').textContent = '';
  document.querySelector('#client-notes-meta').textContent = client.notesUpdatedAt
    ? `Última edición: ${client.notesUpdatedBy || '—'} · ${new Date(client.notesUpdatedAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}`
    : 'Visibles para el trabajador y el administrador';
}

function saveClientNotes() {
  const client = clients[state.activeClient];
  const input = document.querySelector('#client-notes-input');
  if (!client) return;
  client.notes = input.value.trim();
  client.notesUpdatedAt = new Date().toISOString();
  client.notesUpdatedBy = state.userRole === 'admin' ? 'Administrador' : state.activeWorker?.name || 'Trabajador';
  persistBusinessData();
  renderClientNotes(client);
  document.querySelector('#client-notes-status').textContent = '✓ Nota guardada';
}

function renderLocationLink(client) {
  const customerLocation = document.querySelector('#client-location-link');
  customerLocation.href = hasCoordinates(client.location)
    ? `https://www.google.com/maps/dir/?api=1&destination=${Number(client.location.latitude)},${Number(client.location.longitude)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`;
  customerLocation.setAttribute('aria-label', `Abrir en el mapa el domicilio de ${client.name}: ${client.address}`);
}

/**
 * Aviso de la ficha cuando la cartulina no tiene ubicación (se creó sin GPS) o la tiene
 * aproximada. El trabajador la toma desde aquí cuando está en el domicilio; el admin ve el
 * aviso pero no el botón (su GPS sería el de la oficina) y puede ubicarlo en el mapa.
 */
function renderLocationPending(client) {
  const box = document.querySelector('#client-location-pending');
  const located = hasCoordinates(client.location);
  const approximate = located && isApproximateLocation(client.location);
  box.hidden = (located && !approximate) || Number(client.balance) <= 0;
  if (box.hidden) return;
  const isWorker = state.userRole === 'worker';
  box.classList.toggle('is-approximate', approximate);
  document.querySelector('#client-location-pending-title').textContent = approximate ? `Ubicación aproximada (± ${client.location.accuracy} m)` : 'Sin ubicación GPS';
  const reason = client.locationFailure && LOCATION_FAILURE_LABELS[client.locationFailure];
  document.querySelector('#client-location-pending-text').textContent = !isWorker
    ? 'El trabajador puede tomarla desde esta ficha, o ubícalo tú en el Mapa de clientes.'
    : approximate ? 'Si estás en el domicilio, tómala de nuevo para que quede exacta en el mapa.'
    : `${reason ? `No se pudo tomar al crearla (${reason}). ` : ''}Tómala cuando estés en el domicilio del cliente.`;
  const button = document.querySelector('#client-capture-location');
  button.hidden = !isWorker;
  button.innerHTML = `<span aria-hidden="true">⌖</span> ${approximate ? 'Tomar de nuevo' : 'Tomar ubicación ahora'}`;
}

async function captureClientLocation() {
  const clientId = state.activeClient;
  const button = document.querySelector('#client-capture-location');
  if (!clients[clientId] || button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Tomando ubicación…';
  const { location, reason } = await locateDevice({ timeout: 10000 });
  button.disabled = false;
  button.removeAttribute('aria-busy');
  const client = clients[clientId];
  if (!client) return;
  if (!location) {
    client.locationFailure = reason;
    persistBusinessData();
    if (state.activeClient === clientId) renderLocationPending(client);
    showToast(`No se pudo tomar la ubicación (${LOCATION_FAILURE_LABELS[reason] || 'sin GPS'}). Inténtalo de nuevo en el domicilio.`);
    return;
  }
  client.location = { ...location, source: 'ficha', by: state.activeWorker?.name || 'Trabajador' };
  delete client.locationPending;
  delete client.locationFailure;
  persistBusinessData();
  if (state.activeClient === clientId) { renderLocationLink(client); renderLocationPending(client); }
  showToast(isApproximateLocation(client.location)
    ? `Ubicación de ${client.name} guardada, pero es aproximada (± ${client.location.accuracy} m).`
    : `Ubicación de ${client.name} guardada (± ${client.location.accuracy} m).`);
}

export function openClient(clientId) {
  const client = clients[clientId];
  if (!client) return;
  state.paymentFromHome = false;
  state.activeClient = clientId;
  document.querySelector('#detail-name').textContent = client.name;
    setClientAvatar(document.querySelector('#detail-avatar'), client);
  paintCardColorBand(document.querySelector('#detail-card-color'), client, document.querySelector('#detalle-cliente .detail-header'));
  // Estado actual: si hay períodos vencidos sin pagar se muestran como «Pagos atrasados N».
  const status = document.querySelector('#detail-status');
  const current = paymentBehavior(client);
  const late = current.overduePeriods > 0 || client.late;
  status.textContent = current.overduePeriods > 0 ? current.label : Number(client.balance) <= 0 ? 'Pagada' : client.status;
  status.classList.toggle('status-late', late);
  status.classList.toggle('status-current', !late);
  updateMoratoryButton(client);
  document.querySelector('#detail-balance').textContent = formatMoney(client.balance);
  document.querySelector('#detail-balance-copy').textContent = formatMoney(client.balance);
  const totalPaid = Math.max(0, Number(client.totalPaidAmount ?? (client.payments || []).reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) || 0), 0)));
  const outstanding = Math.max(0, Number(client.balance) || 0);
  const progressPercent = paidPercent(client);
  document.querySelector('#detail-paid-amount').textContent = formatMoney(totalPaid);
  document.querySelector('#detail-total-amount').textContent = formatMoney(totalPaid + outstanding);
  document.querySelector('.progress-ring').style.setProperty('--progress', `${progressPercent * 3.6}deg`);
  document.querySelector('.progress-center > strong').textContent = `${progressPercent}%`;
  document.querySelector('.progress-ring').setAttribute('aria-label', `${progressPercent} por ciento pagado`);
  const day = creditDay(client);
  document.querySelector('#route-day').textContent = `Día ${day} / ${client.totalDays} días`;
  const overdueDays = Math.max(0, day - client.totalDays);
  // Admin y trabajador ven lo mismo: los días que faltan o, ya vencida, los días de mora.
  const settled = Number(client.balance) <= 0;
  document.querySelector('#route-days-label').textContent = settled ? 'Cartulina pagada' : overdueDays > 0 ? 'Días de mora' : 'Días restantes para finalizar';
  document.querySelector('#route-days-left').textContent = settled ? `Pagada en ${day} ${day === 1 ? 'día' : 'días'}` : overdueDays > 0 ? `${overdueDays} ${overdueDays === 1 ? 'día' : 'días'}` : `Faltan ${Math.max(0, client.totalDays - day)} días`;
  document.querySelector('#route-days-left').classList.toggle('is-overdue', !settled && overdueDays > 0);
  document.querySelector('#detail-installment').textContent = formatMoney(client.installment);
  document.querySelector('#detail-id').textContent = client.id;
  document.querySelector('#detail-address').textContent = client.address;
  renderLocationLink(client);
  renderLocationPending(client);
  document.querySelector('#detail-phone').textContent = client.phone;
  document.querySelector('#detail-loan-total').textContent = formatMoney(client.total);
  document.querySelector('#detail-term').textContent = client.term;
  document.querySelector('#detail-frequency').textContent = paymentFrequencyLabels[client.frequency] || 'Semanal';
  document.querySelector('#detail-loan-count').textContent = loanCountLabel(loanCount(clients, client.id));
  document.querySelector('#detail-breakdown').textContent = client.breakdown;
  renderAddressDetails(client);
  renderClientNotes(client);
  document.querySelector('#detail-interest-rate').textContent = `${client.interestPercent ?? 20}%`;
  renderInsuranceDetails(client);
  renderRenewalDetails(client);
  updatePaymentBehaviorUI(client);
  document.querySelector('#payment-client-name').textContent = client.name;
  renderCardActions(client);
  renderPersonCards(state.activeClient);
  document.querySelector('[data-open-payment]').innerHTML = state.userRole === 'admin' ? 'Registrar abono <span aria-hidden="true">→</span>' : 'Registrar Pago <span aria-hidden="true">→</span>';
  document.querySelector('#admin-client-actions').hidden = state.userRole !== 'admin';
  refreshClientBalance();
  renderHistory(client);
  // Al abrir desde una lista se guarda su orden para moverse con Anterior / Siguiente.
  if (state.currentView !== 'detalle-cliente') state.cardSequence = visibleCardSequence(state.currentView);
  state.previousView = ['directorio', 'ruta-diaria', 'mapa'].includes(state.currentView) ? state.currentView : 'inicio';
  renderCardNav(clientId);
  closeDisclosure();
  showView('detalle-cliente');
}

/** Cartulinas que se ven en la lista de la pantalla actual, en su orden. */
function visibleCardSequence(view) {
  const selector = view === 'ruta-diaria' ? '#route-daily-list [data-route-client]'
    : view === 'inicio' ? '#inicio .client-row[data-client]:not([hidden])'
      : '#directorio .client-row[data-client]:not([hidden])';
  const ids = [...document.querySelectorAll(selector)].map(node => node.dataset.client || node.dataset.routeClient);
  return [...new Set(ids)].filter(id => clients[id]);
}

function renderCardNav(clientId) {
  const ids = state.cardSequence || [];
  const position = ids.indexOf(clientId);
  const nav = document.querySelector('#card-nav');
  nav.hidden = position < 0 || ids.length < 2;
  if (nav.hidden) return;
  document.querySelector('#card-nav-position').textContent = `${position + 1} de ${ids.length}`;
  document.querySelector('#card-prev').disabled = position === 0;
  document.querySelector('#card-next').disabled = position === ids.length - 1;
}

/** Abre la cartulina anterior o siguiente de la lista sin volver atrás. */
function moveToCard(step) {
  const ids = state.cardSequence || [];
  const next = ids[ids.indexOf(state.activeClient) + step];
  if (!next || !clients[next]) return;
  const back = state.previousView;
  openClient(next);
  state.previousView = back;
  window.scrollTo({ top: 0 });
}

function closeDisclosure() {
  disclosureButton.setAttribute('aria-expanded', 'false');
  creditDetails.classList.remove('is-expanded');
  creditDetails.style.maxHeight = '0px';
  window.setTimeout(() => {
    if (!creditDetails.classList.contains('is-expanded')) creditDetails.hidden = true;
  }, 240);
}

function toggleDisclosure() {
  const expanded = disclosureButton.getAttribute('aria-expanded') === 'true';
  if (expanded) return closeDisclosure();
  creditDetails.hidden = false;
  creditDetails.style.maxHeight = '0px';
  requestAnimationFrame(() => {
    creditDetails.classList.add('is-expanded');
    creditDetails.style.maxHeight = `${creditDetails.scrollHeight}px`;
  });
  disclosureButton.setAttribute('aria-expanded', 'true');
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
function renderInsuranceDetails(client) {
  const insurance = clientInsurance(client);
  document.querySelector('#detail-insurance').textContent = insurance.custom
    ? `${formatMoney(insurance.amount)} · valor especial`
    : `${formatMoney(insurance.amount)} · general (10%)`;
  const reasonRow = document.querySelector('#detail-insurance-reason-row');
  reasonRow.hidden = !insurance.custom;
  document.querySelector('#detail-insurance-reason').textContent = insurance.reason || 'Sin comentario registrado';
}

function renewalDate(value) {
  return value ? formatDate(value) : 'fecha sin registrar';
}

function renderRenewalDetails(client) {
  const row = document.querySelector('#detail-renewal-row');
  const parts = [];
  if (client.renewedFrom) parts.push(`Renovación #${client.renewalCount || 1} · reemplaza la cartulina del ${renewalDate(clients[client.renewedFrom]?.creditStartDate)}`);
  const renewed = client.renewedTo && clients[client.renewedTo];
  if (renewed) parts.push(`Renovado el ${renewalDate(client.renewedAt)} con una cartulina nueva de ${formatMoney(clients[client.renewedTo].principal)}`);
  row.hidden = !parts.length;
  document.querySelector('#detail-renewal').textContent = parts.join(' · ');
}

/**
 * Acciones de la cartulina, arriba de la ficha:
 * - Registrar pago: solo mientras tenga saldo.
 * - Renovar: solo cuando está cancelada por completo y no se ha renovado antes.
 * - Otra cartulina: crédito simultáneo para la misma persona (hasta el máximo).
 */
function renderCardActions(client) {
  const cancelled = Number(client.balance) <= 0;
  const renewed = client.renewedTo && clients[client.renewedTo];
  const payButton = document.querySelector('[data-open-payment]');
  const renewButton = document.querySelector('#renew-client');
  const extraButton = document.querySelector('#extra-card-client');
  const hint = document.querySelector('#renew-hint');
  payButton.hidden = cancelled;
  // Renovar siempre está a la vista; mientras quede saldo aparece bloqueado y dice cuánto falta.
  renewButton.hidden = Boolean(renewed);
  const locked = !canRenew(state.activeClient);
  renewButton.classList.toggle('is-locked', locked);
  renewButton.setAttribute('aria-disabled', String(locked));
  const pending = document.querySelector('#renew-pending');
  pending.hidden = cancelled;
  pending.textContent = cancelled ? '' : `Falta pagar ${formatMoney(client.balance)}`;
  renewButton.title = locked ? 'Para renovar, primero hay que pagar todo el saldo de esta cartulina' : 'Crear una cartulina nueva con los mismos datos';
  const room = canAddCard(clients, client.id);
  extraButton.disabled = !room;
  extraButton.title = room ? 'Abrir otro crédito a nombre de esta persona' : `Máximo ${MAX_ACTIVE_CARDS_PER_PERSON} cartulinas activas por persona`;
  const notes = [];
  if (renewed) notes.push('Esta cartulina ya fue renovada.');
  if (!room) notes.push(`La persona ya tiene ${MAX_ACTIVE_CARDS_PER_PERSON} cartulinas activas (máximo).`);
  // Financiar y retanqueo mientras la cartulina tenga saldo. El admin lo aplica; el
  // trabajador llena lo mismo y le llega al admin como solicitud para aprobar o rechazar.
  const openRequest = pendingRestructure(pendingRequests, state.activeClient);
  const isWorker = state.userRole !== 'admin';
  // El trabajador solo puede solicitar financiar cuando ya pasaron los días del plazo.
  const daysLeft = Math.max(0, Number(client.totalDays || 0) - creditDay(client));
  const financeLocked = isWorker && !financeAllowed(client);
  [['#finance-client', 'finance', 'Financiar', 'Intereses por pasar el plazo'], ['#retanqueo-client', 'retanqueo', 'Retanqueo', 'Prestar más sobre esta cartulina']].forEach(([selector, type, label, sub]) => {
    const button = document.querySelector(selector);
    button.hidden = cancelled;
    const waiting = isWorker && openRequest?.type === type;
    const locked = type === 'finance' && financeLocked;
    button.disabled = (isWorker && Boolean(openRequest)) || locked;
    button.querySelector('.detail-action-label').lastChild.textContent = ` ${isWorker ? `Solicitar ${label.toLocaleLowerCase('es')}` : label}`;
    button.querySelector('.detail-action-sub').textContent = waiting ? 'Solicitud enviada: esperando al admin' : isWorker && openRequest ? 'Hay otra solicitud pendiente'
      : locked ? `Disponible cuando venza el plazo (falta${daysLeft === 1 ? '' : 'n'} ${daysLeft} día${daysLeft === 1 ? '' : 's'})` : sub;
  });
  hint.textContent = notes.join(' ');
  hint.hidden = !notes.length;
  document.querySelector('.detail-profile .eyebrow').textContent = cancelled ? 'CARTULINA CANCELADA' : 'CRÉDITO ACTIVO';
}

/**
 * Selector de cartulinas de la persona: solo las ACTIVAS (las canceladas no se muestran arriba).
 * Se ve con 2 o más activas, o si se abrió una cancelada y la persona tiene alguna activa.
 */
function renderPersonCards(clientId) {
  const client = clients[clientId];
  const ids = activeCardIds(clients, client.id);
  const nav = document.querySelector('#person-cards');
  const list = document.querySelector('#person-cards-list');
  const currentActive = ids.includes(clientId);
  const show = ids.length >= 2 || (!currentActive && ids.length >= 1);
  nav.hidden = !show;
  list.replaceChildren();
  if (!show) return;
  document.querySelector('#person-cards-label').textContent = `${ids.length} cartulina${ids.length === 1 ? '' : 's'} activa${ids.length === 1 ? '' : 's'}`;
  ids.forEach((id, index) => {
    const card = clients[id];
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'person-card-chip';
    chip.dataset.personCard = id;
    chip.classList.toggle('is-current', id === clientId);
    if (id === clientId) chip.setAttribute('aria-current', 'true');
    const name = document.createElement('strong');
    name.textContent = ids.length > 1 ? `Cartulina ${index + 1}` : 'Cartulina activa';
    const balance = document.createElement('small');
    balance.textContent = `Saldo ${formatMoney(card.balance)}`;
    chip.append(name, balance);
    list.append(chip);
  });
}

/** Repinta la ficha, el directorio y la liquidación después de cambiar la cartulina. */
function afterRestructure(clientId) {
  persistBusinessData();
  renderClientRows(clientId);
  filterClientCards();
  if (routeSelect.value === clients[clientId]?.route) renderAdminRoute(routeSelect.value);
  openClient(clientId);
}

/** Financiar es para cartulinas que ya pasaron los días del plazo acordado. */
const financeAllowed = client => creditDay(client) > Number(client.totalDays || 0);

/**
 * Solicitud del trabajador al admin con los parámetros que él mismo puso. El admin la aprueba
 * (se aplica tal cual) o la rechaza desde Solicitudes.
 */
function sendRestructureRequest(clientId, type, params) {
  const client = clients[clientId];
  pendingRequests.unshift({
    id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, routeId: routeKey(client.route), route: client.route,
    workerId: state.activeWorker?.id, workerName: state.activeWorker?.name || 'Trabajador', clientId, clientName: client.name,
    params, createdAt: new Date().toISOString(), status: 'pending',
  });
  persistBusinessData();
  renderCardActions(client);
  showToast(`Solicitud de ${type === 'finance' ? 'financiación' : 'retanqueo'} enviada al administrador.`);
}

/** Financiar: intereses por pasar los días acordados (20 % del saldo si no se escribe otro valor) y plazo nuevo. */
function openFinanceModal() {
  const clientId = state.activeClient;
  const client = clients[clientId];
  if (!client || Number(client.balance) <= 0) return;
  const isWorker = state.userRole !== 'admin';
  if (isWorker && pendingRestructure(pendingRequests, clientId)) { showToast('Esta cartulina ya tiene una solicitud pendiente con el administrador.'); return; }
  if (isWorker && !financeAllowed(client)) { showToast('Solo se puede solicitar financiar cuando ya pasaron los días del plazo.'); return; }
  openCustomModal({
    title: `${isWorker ? 'Solicitar financiar' : 'Financiar'} · ${client.name}`,
    description: `Saldo actual ${formatMoney(client.balance)}. Se le suman los intereses de financiación y arranca un plazo nuevo desde hoy.`,
    fields: [
      { type: 'note', label: 'Interés de financiación', value: `${FINANCE_INTEREST_PERCENT}%`, hint: `General: ${FINANCE_INTEREST_PERCENT} % del saldo = ${formatMoney(percentOrAmount(client.balance, FINANCE_INTEREST_PERCENT))}`, valueId: 'finance-rate-value', hintId: 'finance-rate-hint' },
      { type: 'checkbox', name: 'customInterest', label: 'Usar un interés diferente al general' },
      { name: 'percent', label: 'Interés de financiación (%) sobre el saldo', type: 'number', min: 0, max: 100, step: 0.1, value: FINANCE_INTEREST_PERCENT, required: true, showWhen: 'customInterest' },
      { name: 'totalDays', label: 'Plazo nuevo (días) desde hoy', type: 'number', min: 1, step: 1, value: client.totalDays || 30, required: true },
    ],
    onInput: form => {
      const percent = form.elements.customInterest.checked ? Number(form.elements.percent.value) || 0 : FINANCE_INTEREST_PERCENT;
      document.querySelector('#finance-rate-value').textContent = `${percent}%`;
      document.querySelector('#finance-rate-hint').textContent = `${percent} % del saldo = ${formatMoney(percentOrAmount(client.balance, percent))}`;
    },
    submitLabel: isWorker ? 'Enviar solicitud al admin' : 'Financiar',
    onSubmit: values => {
      const percent = values.customInterest ? Number(values.percent) : FINANCE_INTEREST_PERCENT;
      const interest = percentOrAmount(client.balance, percent);
      if (!(interest > 0)) { customModalError.textContent = 'Escribe un porcentaje mayor que cero.'; return false; }
      if (isWorker) {
        sendRestructureRequest(clientId, 'finance', { interest, totalDays: Math.round(Number(values.totalDays)), percent, balance: Number(client.balance) });
        return;
      }
      financeCard(client, { interest, totalDays: values.totalDays });
      afterRestructure(clientId);
      showToast(`Cartulina financiada: +${formatMoney(interest)} de intereses. Saldo nuevo ${formatMoney(client.balance)}, ${client.installments} cuotas de ${formatMoney(client.installment)}.`);
    },
  });
}

/**
 * Retanqueo: se le presta un monto extra antes de terminar de pagar. Al extra se le suman
 * intereses (20 %) y se cobran seguros (10 %), salvo que se escriba otro % o un monto exacto.
 * El préstamo sale de la liquidación de hoy y los seguros entran a la base del día.
 */
function openRetanqueoModal() {
  const clientId = state.activeClient;
  const client = clients[clientId];
  if (!client || Number(client.balance) <= 0) return;
  const isWorker = state.userRole !== 'admin';
  if (isWorker && pendingRestructure(pendingRequests, clientId)) { showToast('Esta cartulina ya tiene una solicitud pendiente con el administrador.'); return; }
  openCustomModal({
    title: `${isWorker ? 'Solicitar retanqueo' : 'Retanqueo'} · ${client.name}`,
    description: `Saldo actual ${formatMoney(client.balance)}. Al monto extra se le suman intereses y se cobran seguros; el saldo nuevo arranca un plazo nuevo desde hoy.`,
    fields: [
      { name: 'extra', label: 'Monto extra que se le presta', money: true, thousands: true, type: 'number', min: 1, step: 1, value: '', required: true },
      { type: 'note', label: 'Interés sobre el extra', value: `${RETANQUEO_INTEREST_PERCENT}%`, hint: `General: ${RETANQUEO_INTEREST_PERCENT} % del monto extra`, valueId: 'retanqueo-rate-value', hintId: 'retanqueo-rate-hint' },
      { type: 'checkbox', name: 'customInterest', label: 'Usar un interés diferente al general' },
      { name: 'interestPercent', label: 'Interés del retanqueo (%)', type: 'number', min: 0, max: 100, step: 0.1, value: RETANQUEO_INTEREST_PERCENT, required: true, showWhen: 'customInterest' },
      { type: 'note', className: 'default-rate-note insurance-rate-note', label: 'Seguros', value: formatMoney(0), hint: `General: ${GENERAL_RETANQUEO.insurancePercent} % del monto extra`, valueId: 'retanqueo-insurance-value', hintId: 'retanqueo-insurance-hint' },
      { type: 'checkbox', name: 'customInsurance', label: 'Cobrar un valor de seguros diferente al general' },
      { name: 'insuranceAmount', label: 'Valor de los seguros ($)', money: true, thousands: true, type: 'number', min: 0, step: 1, value: '', required: true, showWhen: 'customInsurance', placeholder: 'Ej. 10' },
      { name: 'insuranceReason', label: '¿Por qué este valor es diferente?', type: 'textarea', rows: 2, value: '', showWhen: 'customInsurance', placeholder: 'Ej. Cliente antiguo, acuerdo especial…' },
      { name: 'totalDays', label: 'Plazo nuevo (días) desde hoy', type: 'number', min: 1, step: 1, value: client.totalDays || 30, required: true },
    ],
    onInput: form => {
      const extra = Math.round(Number(form.elements.extra.value) || 0);
      const percent = form.elements.customInterest.checked ? Number(form.elements.interestPercent.value) || 0 : RETANQUEO_INTEREST_PERCENT;
      document.querySelector('#retanqueo-rate-value').textContent = `${percent}%`;
      document.querySelector('#retanqueo-rate-hint').textContent = extra ? `${percent} % del monto extra = ${formatMoney(percentOrAmount(extra, percent))}` : `${percent} % del monto extra`;
      const insurance = form.elements.customInsurance.checked ? Math.round(Number(form.elements.insuranceAmount.value) || 0) : percentOrAmount(extra, GENERAL_RETANQUEO.insurancePercent);
      document.querySelector('#retanqueo-insurance-value').textContent = formatMoney(insurance);
      document.querySelector('#retanqueo-insurance-hint').textContent = form.elements.customInsurance.checked ? 'Valor diferente al general' : `General: ${GENERAL_RETANQUEO.insurancePercent} % del monto extra`;
    },
    submitLabel: isWorker ? 'Enviar solicitud al admin' : 'Hacer retanqueo',
    onSubmit: values => {
      const extra = Math.round(Number(values.extra) || 0);
      if (extra <= 0) { customModalError.textContent = 'Escribe el monto extra que se le presta.'; return false; }
      const interest = percentOrAmount(extra, values.customInterest ? Number(values.interestPercent) : RETANQUEO_INTEREST_PERCENT);
      const insurance = values.customInsurance ? Math.round(Number(values.insuranceAmount) || 0) : percentOrAmount(extra, GENERAL_RETANQUEO.insurancePercent);
      const insuranceReason = values.customInsurance ? String(values.insuranceReason || '').trim() : '';
      if (insurance > extra) { customModalError.textContent = 'Los seguros no pueden superar el monto extra.'; return false; }
      if (values.customInsurance && !insuranceReason) { customModalError.textContent = 'Escribe por qué los seguros son diferentes al general.'; return false; }
      if (isWorker) {
        sendRestructureRequest(clientId, 'retanqueo', { extra, interest, insurance, insuranceReason, totalDays: Math.round(Number(values.totalDays)), balance: Number(client.balance) });
        return;
      }
      retanqueoCard(client, { extra, interest, insurance, insuranceReason, totalDays: values.totalDays });
      recordRetanqueoInRoute(routeSettlements[client.route], client, clientId, { extra, interest, insurance });
      afterRestructure(clientId);
      showToast(`Retanqueo de ${formatMoney(extra)}: intereses ${formatMoney(interest)}, seguros ${formatMoney(insurance)}. Saldo nuevo ${formatMoney(client.balance)}.`);
    },
  });
}

export function mount() {
  document.querySelector('#card-prev').addEventListener('click', () => moveToCard(-1));
  document.querySelector('#card-next').addEventListener('click', () => moveToCard(1));
  document.querySelector('#finance-client').addEventListener('click', openFinanceModal);
  document.querySelector('#retanqueo-client').addEventListener('click', openRetanqueoModal);
  document.querySelector('#client-capture-location').addEventListener('click', captureClientLocation);
  // La ubicación llegó tarde (reintento tras crear la cartulina): se actualiza la ficha abierta.
  document.addEventListener('edgecredit:client-location', event => {
    const client = clients[event.detail?.clientId];
    if (client && state.activeClient === event.detail.clientId) { renderLocationLink(client); renderLocationPending(client); }
  });
  onClientRenewed(clientId => openClient(clientId));
  document.querySelector('#person-cards-list').addEventListener('click', event => {
    const chip = event.target.closest('[data-person-card]');
    if (!chip || chip.dataset.personCard === state.activeClient) return;
    const back = state.previousView;
    openClient(chip.dataset.personCard);
    state.previousView = back;
  });
  disclosureButton.addEventListener('click', toggleDisclosure);
  // El historial de direcciones vive dentro del panel desplegable: al abrirlo, recalcula su alto.
  document.querySelector('#address-history').addEventListener('toggle', () => {
    if (creditDetails.classList.contains('is-expanded')) creditDetails.style.maxHeight = `${creditDetails.scrollHeight}px`;
  });
  const notesInput = document.querySelector('#client-notes-input');
  notesInput.addEventListener('input', () => {
    document.querySelector('#save-client-notes').disabled = notesInput.value === notesInput.dataset.saved;
    document.querySelector('#client-notes-status').textContent = notesInput.value === notesInput.dataset.saved ? '' : 'Cambios sin guardar';
  });
  document.querySelector('#save-client-notes').addEventListener('click', saveClientNotes);
  document.querySelector('#edit-client').addEventListener('click', () => {
    if (state.userRole !== 'admin') return;
    const client = clients[state.activeClient];
    // Día de cobro de las semanales (define su color). Domingo solo aparece si ya quedó así.
    const currentPayday = client.creditStartDate ? weekdayOf(client.creditStartDate) : 1;
    const paydayOptions = PAYDAY_OPTIONS.map(option => ({ value: String(option.weekday), label: option.label }));
    if (currentPayday === 0) paydayOptions.unshift({ value: '0', label: 'Domingo (sin color)' });
    // Diaria, quincenal o mensual entregada (o iniciada) un domingo: se guarda con la fecha del sábado o del lunes.
    const sunday = client.deliveredOn && weekdayOf(client.deliveredOn) === 0 ? client.deliveredOn : currentPayday === 0 ? client.creditStartDate : null;
    const shiftValue = !sunday ? '' : client.creditStartDate === shiftDays(sunday, -1) ? 'prev' : client.creditStartDate === shiftDays(sunday, 1) ? 'next' : client.creditStartDate === sunday ? 'sun' : '';
    const shiftField = sunday && (client.frequency || 'weekly') !== 'weekly' && shiftValue
      ? [{ name: 'sundayShift', label: 'Entregada un domingo · fecha con que se guarda', type: 'select', value: shiftValue, options: [
        ...(shiftValue === 'sun' ? [{ value: 'sun', label: `Domingo ${formatDate(sunday)}` }] : []),
        { value: 'prev', label: `Sábado ${formatDate(shiftDays(sunday, -1))} · día anterior` },
        { value: 'next', label: `Lunes ${formatDate(shiftDays(sunday, 1))} · día siguiente` },
      ] }]
      : [];
    openCustomModal({
      title: 'Editar cartulina completa', description: 'Actualiza los datos personales, financieros y el calendario del crédito.',
      fields: [
        { name: 'name', label: 'Nombre completo', value: client.name, required: true },
        { name: 'id', label: 'Cédula', value: client.id, required: true },
        { name: 'phone', label: 'Teléfono', value: client.phone, required: true },
        { name: 'address', label: 'Dirección principal', value: client.address, required: true },
        { name: 'altAddress', label: 'Dirección alternativa (trabajo u otro lugar) · opcional', value: client.altAddress || '' },
        { name: 'addressNotes', label: 'Indicaciones del domicilio', type: 'textarea', rows: 2, value: client.addressNotes || '' },
        { name: 'route', label: 'Ruta / nombre del cobro', type: 'text', value: routeSettlements[client.route]?.name || client.route, required: true },
        { name: 'frequency', label: 'Frecuencia de pago', type: 'select', value: client.frequency || 'weekly', options: Object.entries(paymentFrequencyLabels).map(([value, label]) => ({ value, label })) },
        ...((client.frequency || 'weekly') === 'weekly' ? [{ name: 'paymentWeekday', label: 'Día de cobro (define el color)', type: 'select', value: String(currentPayday), options: paydayOptions }] : shiftField),
        { name: 'principal', label: 'Capital prestado ($)', type: 'number', min: 0, step: 1, value: inferClientPrincipal(client), required: true },
        { name: 'total', label: 'Valor total del crédito ($)', type: 'number', min: 0, step: 1, value: client.total, required: true },
        { name: 'balance', label: 'Saldo pendiente ($)', type: 'number', min: 0, step: 1, value: client.balance, required: true },
        { name: 'installment', label: 'Valor de cuota ($)', type: 'number', min: 0, step: 1, value: client.installment, required: true },
        { name: 'interestPercent', label: 'Interés (%)', type: 'number', min: 0, step: 0.1, value: client.interestPercent ?? 20, required: true },
        { name: 'insuranceAmount', label: `Seguros cobrados ($) · general: ${formatMoney(generalInsuranceAmount(inferClientPrincipal(client)))}`, type: 'number', min: 0, step: 1, value: clientInsurance(client).amount, required: true },
        { name: 'insuranceReason', label: 'Motivo si los seguros son diferentes al 10%', type: 'textarea', rows: 2, value: clientInsurance(client).reason },
        { name: 'paid', label: 'Cuotas pagadas', type: 'number', min: 0, step: 1, value: client.paid, required: true },
        { name: 'installments', label: 'Total de cuotas', type: 'number', min: 1, step: 1, value: client.installments, required: true },
        { name: 'creditStartDate', label: 'Fecha de inicio de la cartulina (si la cambias, manda sobre el día de cobro y los días que lleva)', type: 'date', value: client.creditStartDate || localDateISO(), required: true },
        { type: 'note', className: 'default-rate-note start-color-note', label: 'Color de la cartulina', value: startColorLabel(client.frequency || 'weekly', client.creditStartDate), valueId: 'edit-start-color', hint: 'Las semanales toman el color del día de la semana en que inicia.' },
        { name: 'routeDay', label: 'Días que lleva el crédito', type: 'number', min: 0, step: 1, value: creditDay(client), required: true },
        { name: 'totalDays', label: 'Duración acordada (días)', type: 'number', min: 1, step: 1, value: client.totalDays, required: true },
        { name: 'status', label: 'Estado', type: 'select', value: client.late ? 'late' : 'current', options: [{ value: 'current', label: 'Al día' }, { value: 'late', label: 'Mora' }] },
      ],
      onSubmit: values => {
        const oldPrincipal = inferClientPrincipal(client);
        const oldState = { route: client.route, principal: oldPrincipal, total: Number(client.total) };
        if (Number(values.interestPercent) > 100) {
          customModalError.textContent = 'El interés debe estar entre 0 y 100%.';
          return false;
        }
        const startChanged = values.creditStartDate !== (client.creditStartDate || localDateISO());
        if (startChanged && !/^\d{4}-\d{2}-\d{2}$/.test(values.creditStartDate || '')) { customModalError.textContent = 'Escribe la fecha de inicio de la cartulina.'; return false; }
        if (startChanged && weekdayOf(values.creditStartDate) === 0) {
          customModalError.textContent = 'Esa fecha es domingo y las cartulinas no inician en domingo (quedaría sin color). Elige el sábado o el lunes.';
          return false;
        }
        const insurance = resolveInsurance(values.principal, true, values.insuranceAmount, values.insuranceReason);
        if (insurance.error) { customModalError.textContent = insurance.error; return false; }
        if (Number(values.paid) > Number(values.installments)) {
          customModalError.textContent = 'Las cuotas pagadas no pueden superar el total de cuotas.';
          return false;
        }
        const duplicateId = Object.entries(clients).some(([id, item]) => id !== state.activeClient && item.id === values.id.trim());
        if (duplicateId) { customModalError.textContent = 'Ya existe otro cliente con esa cédula.'; return false; }
        const newClientRoute = ensureRoute(values.route);
        if (!newClientRoute) { customModalError.textContent = 'Escribe el nombre de la ruta / cobro.'; return false; }
        client.name = values.name.trim();
        client.id = values.id.trim();
        client.phone = values.phone.trim();
        // Historial: toda dirección reemplazada queda guardada con fecha. La ubicación GPS
        // anterior deja de valer para la nueva dirección y se conserva en el historial.
        const changedAt = new Date().toISOString();
        client.addressHistory ||= [];
        const newAddress = values.address.trim();
        const newAltAddress = (values.altAddress || '').trim();
        let relocate = false;
        if (newAddress !== client.address) {
          client.addressHistory.push({ type: 'principal', address: client.address, replacedBy: newAddress, location: client.location || null, changedAt, changedBy: 'Administrador' });
          client.address = newAddress;
          if (client.location) { client.location = null; relocate = true; }
        }
        if (newAltAddress !== (client.altAddress || '')) {
          if (client.altAddress) client.addressHistory.push({ type: 'alternativa', address: client.altAddress, replacedBy: newAltAddress || '(eliminada)', location: client.altLocation || null, changedAt, changedBy: 'Administrador' });
          client.altAddress = newAltAddress;
          client.altLocation = null;
        }
        client.addressNotes = (values.addressNotes || '').trim();
        if (relocate) window.setTimeout(() => showToast(`La dirección de ${client.name} cambió: ubícala de nuevo en el Mapa de clientes.`), 50);
        client.route = newClientRoute;
        client.frequency = paymentFrequencyDays[values.frequency] ? values.frequency : 'weekly';
        client.principal = Number(values.principal);
        client.total = Number(values.total);
        client.balance = Number(values.balance);
        client.settledAt = client.balance <= 0 ? client.settledAt || localDateISO() : null;
        client.installment = Number(values.installment);
        client.interestPercent = Number(values.interestPercent);
        client.insurancePercent = null;
        client.insuranceAmount = insurance.amount;
        client.insuranceCustom = insurance.custom;
        client.insuranceReason = insurance.reason;
        client.paid = Number(values.paid);
        client.schedulePaidBaseline = Number(values.paid);
        client.installments = Number(values.installments);
        const startBefore = client.creditStartDate;
        if (startChanged) {
          // Fecha de inicio escrita por el admin: manda sobre los días que lleva y el día de cobro.
          // El color sale solo de esa fecha (día de la semana en las semanales).
          client.creditStartDate = values.creditStartDate;
        } else {
          // Corregir los días mueve la fecha de inicio: así siguen subiendo solos cada día.
          if (Number(values.routeDay) !== creditDay(client)) client.creditStartDate = startDateForCreditDay(values.routeDay);
          // Cambiar el día de cobro mueve el inicio a ese día de la semana.
          const payday = Number(values.paymentWeekday);
          if (client.frequency === 'weekly' && client.creditStartDate && payday >= 1 && payday <= 6 && payday !== weekdayOf(client.creditStartDate)) {
            client.creditStartDate = startDateForPayday(client, payday);
          }
          if (client.frequency !== 'weekly' && sunday && (values.sundayShift === 'prev' || values.sundayShift === 'next') && values.sundayShift !== shiftValue) {
            client.creditStartDate = shiftDays(sunday, values.sundayShift === 'prev' ? -1 : 1);
          }
        }
        // Con otra fecha de inicio los abonos se reubican en sus cuotas.
        if (client.creditStartDate !== startBefore) reassignPaymentCycles(client);
        client.routeDay = creditDay(client);
        client.totalDays = Number(values.totalDays);
        client.term = `${client.totalDays} días`;
        client.status = values.status === 'late' ? 'Mora' : 'Al día';
        client.late = values.status === 'late';
        client.progress = client.installments ? Math.round((client.paid / client.installments) * 100) : 0;
        client.breakdown = `${formatMoney(client.principal)} / ${formatMoney(client.total - client.principal)}`;
        client.initials = client.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
        updateClientLoanAccounting(client, state.activeClient, oldState, { route: client.route, principal: client.principal, total: client.total });
        syncCancelledCard(client, state.activeClient);
        if (routeSelect.value === oldState.route || routeSelect.value === client.route) renderAdminRoute(routeSelect.value);
        persistBusinessData();
        const returnView = state.previousView;
        openClient(state.activeClient);
        state.previousView = returnView;
        renderClientRows(state.activeClient);
        filterClientCards();
      }
    });
  });
  // Editar cartulina: el color se actualiza en vivo al cambiar la fecha de inicio o la frecuencia.
  const refreshStartColor = event => {
    const form = event.target.closest?.('#custom-modal-form');
    const note = document.querySelector('#edit-start-color');
    if (!form || !note || !['creditStartDate', 'frequency'].includes(event.target.name)) return;
    note.textContent = startColorLabel(form.elements.frequency?.value || 'weekly', form.elements.creditStartDate?.value);
    customModalError.textContent = '';
  };
  document.addEventListener('input', refreshStartColor);
  document.addEventListener('change', refreshStartColor);
  // Abonos del día (Resumen del día del trabajador): tocar el cliente abre su cartulina.
  document.addEventListener('click', event => {
    const target = event.target.closest?.('[data-open-client]');
    if (target && clients[target.dataset.openClient]) openClient(target.dataset.openClient);
  });
  document.querySelector('#delete-client').addEventListener('click', () => removeClient(state.activeClient));
  document.querySelector('#payment-history-list').addEventListener('click', event => {
    const button = event.target.closest('[data-payment-action]');
    if (!button || state.userRole !== 'admin') return;
    const client = clients[state.activeClient];
    const index = Number(button.dataset.paymentIndex);
    if (!client.payments[index]) return;
    if (button.dataset.paymentAction === 'delete') {
      openCustomModal({
        title: 'Eliminar abono', description: `Se eliminará el abono de ${formatDate(client.payments[index].date)}.`, submitLabel: 'Eliminar',
        onSubmit: () => { const amount = Number(client.payments[index].amount) || 0; client.balance += amount; client.payments.splice(index, 1); if (routeSettlements[client.route]) routeSettlements[client.route].collections = Math.max(0, routeSettlements[client.route].collections - amount); updatePaidAmountTotal(client); client.settledAt = Number(client.balance) <= 0 ? client.settledAt || localDateISO() : null; syncCancelledCard(client, state.activeClient); persistBusinessData(); openClient(state.activeClient); }
      });
    } else {
      const oldAmount = Number(client.payments[index].amount) || 0;
      openCustomModal({
        title: 'Editar abono', description: `Actualiza el monto registrado el ${formatDate(client.payments[index].date)}.`,
        fields: [{ name: 'amount', label: 'Monto del abono', money: true, thousands: true, type: 'number', min: 1, step: 1, value: client.payments[index].amount, required: true }],
        onSubmit: values => {
          const amount = Number(values.amount);
          if (amount > oldAmount + Number(client.balance)) { customModalError.textContent = 'El monto corregido supera el saldo disponible.'; return false; }
          client.balance = Math.max(0, Number(client.balance) + oldAmount - amount);
          client.payments[index].amount = amount;
          if (routeSettlements[client.route]) routeSettlements[client.route].collections = Math.max(0, routeSettlements[client.route].collections + amount - oldAmount);
          client.settledAt = client.balance <= 0 ? client.settledAt || localDateISO() : null;
          updatePaidAmountTotal(client); syncCancelledCard(client, state.activeClient); persistBusinessData(); openClient(state.activeClient);
        }
      });
    }
  });
  document.querySelector('#payment-history-toggle').addEventListener('click', () => {
    if (expandedPaymentHistory.has(state.activeClient)) expandedPaymentHistory.delete(state.activeClient);
    else expandedPaymentHistory.add(state.activeClient);
    renderHistory(clients[state.activeClient]);
  });
}
