/**
 * features/clients/client-detail · Ficha del cliente: saldo, progreso, historial
 * de abonos e intereses, y edición completa (solo admin).
 */

import { paymentFrequencyDays, paymentFrequencyLabels } from '../../core/config.js';
import { creditDetails, customModalError, disclosureButton, interestToggle, routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, ensureRoute, expandedPaymentHistory, persistBusinessData, routeSettlements } from '../../core/store.js';
import { syncCancelledCard, updateClientLoanAccounting } from '../../domain/accounting.js';
import { inferClientPrincipal, paymentBehavior, paymentHistory, rememberWorstHistory, updatePaidAmountTotal } from '../../domain/loan-schedule.js';
import { renderAdminRoute } from '../admin/admin-shell.js';
import { filterClientCards, removeClient, renderClientRows, setClientAvatar } from './directory.js';
import { localDateISO } from '../../shared/dates.js';
import { formatDate, formatMoney } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showView } from '../../ui/navigation.js';
import { showToast } from '../../ui/toast.js';
import { bindImageViewer } from '../../ui/image-viewer.js';
import { hasCoordinates } from '../../shared/geo.js';
import { clientInsurance, generalInsuranceAmount, resolveInsurance } from '../../domain/insurance.js';
import { canRenew, onClientRenewed } from './new-client.js';
import { MAX_ACTIVE_CARDS_PER_PERSON, activeCardIds, canAddCard, personCardIds } from '../../domain/person-cards.js';

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

export function renderHistory(client) {
  const paymentsList = document.querySelector('#payment-history-list');
  paymentsList.replaceChildren();
  client.payments ||= [];
  const isExpanded = expandedPaymentHistory.has(state.activeClient);
  const paymentsToRender = isExpanded ? client.payments : client.payments.slice(0, 3);
  paymentsToRender.forEach((payment, paymentIndex) => {
    const row = document.createElement('li');
    const dateAndMethod = document.createElement('span');
    dateAndMethod.className = 'history-date-method';
    const date = document.createElement('time');
    date.dateTime = payment.date;
    date.textContent = formatDate(payment.date);
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
    const amount = document.createElement('strong');
    amount.textContent = formatMoney(payment.amount);
    row.append(dateAndMethod, amount);
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
}

function updateMoratoryButton(client) {
  const overdue = state.userRole !== 'admin' && client.routeDay >= client.totalDays;
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

export function openClient(clientId) {
  const client = clients[clientId];
  if (!client) return;
  state.paymentFromHome = false;
  state.activeClient = clientId;
  document.querySelector('#detail-name').textContent = client.name;
    setClientAvatar(document.querySelector('#detail-avatar'), client);
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
  const progressPercent = totalPaid + outstanding > 0 ? Math.min(100, Math.round(totalPaid / (totalPaid + outstanding) * 100)) : 100;
  document.querySelector('#detail-paid-amount').textContent = formatMoney(totalPaid);
  document.querySelector('#detail-total-amount').textContent = formatMoney(totalPaid + outstanding);
  document.querySelector('.progress-ring').style.setProperty('--progress', `${progressPercent * 3.6}deg`);
  document.querySelector('.progress-center > strong').textContent = `${progressPercent}%`;
  document.querySelector('.progress-ring').setAttribute('aria-label', `${progressPercent} por ciento pagado`);
  document.querySelector('#route-day').textContent = `Día ${client.routeDay} / ${client.totalDays} días`;
  const overdueDays = Math.max(0, client.routeDay - client.totalDays);
  document.querySelector('#route-days-label').textContent = state.userRole === 'admin' ? 'Días de mora' : 'Días restantes para finalizar';
  document.querySelector('#route-days-left').textContent = state.userRole === 'admin' ? `${overdueDays} ${overdueDays === 1 ? 'día' : 'días'}` : `Faltan ${Math.max(0, client.totalDays - client.routeDay)} días`;
  document.querySelector('#detail-installment').textContent = formatMoney(client.installment);
  document.querySelector('#detail-id').textContent = client.id;
  document.querySelector('#detail-address').textContent = client.address;
  const customerLocation = document.querySelector('#client-location-link');
  customerLocation.href = hasCoordinates(client.location)
    ? `https://www.google.com/maps/dir/?api=1&destination=${Number(client.location.latitude)},${Number(client.location.longitude)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`;
  customerLocation.setAttribute('aria-label', `Abrir en el mapa el domicilio de ${client.name}: ${client.address}`);
  document.querySelector('#detail-phone').textContent = client.phone;
  document.querySelector('#detail-loan-total').textContent = formatMoney(client.total);
  document.querySelector('#detail-term').textContent = client.term;
  document.querySelector('#detail-frequency').textContent = paymentFrequencyLabels[client.frequency] || 'Semanal';
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
  state.previousView = ['directorio', 'ruta-diaria', 'mapa'].includes(state.currentView) ? state.currentView : 'inicio';
  closeDisclosure();
  showView('detalle-cliente');
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
  hint.textContent = notes.join(' ');
  hint.hidden = !notes.length;
  document.querySelector('.detail-profile .eyebrow').textContent = cancelled ? 'CARTULINA CANCELADA' : 'CRÉDITO ACTIVO';
}

/** Selector de cartulinas cuando la persona tiene más de una (activas, canceladas o renovadas). */
function renderPersonCards(clientId) {
  const client = clients[clientId];
  const ids = personCardIds(clients, client.id);
  const nav = document.querySelector('#person-cards');
  const list = document.querySelector('#person-cards-list');
  nav.hidden = ids.length < 2;
  list.replaceChildren();
  if (ids.length < 2) return;
  const active = activeCardIds(clients, client.id).length;
  document.querySelector('#person-cards-label').textContent = `${ids.length} cartulinas · ${active} activa${active === 1 ? '' : 's'}`;
  ids.forEach((id, index) => {
    const card = clients[id];
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'person-card-chip';
    chip.dataset.personCard = id;
    const isCancelled = Number(card.balance) <= 0;
    chip.classList.toggle('is-current', id === clientId);
    chip.classList.toggle('is-cancelled', isCancelled);
    if (id === clientId) chip.setAttribute('aria-current', 'true');
    chip.innerHTML = `<strong>Cartulina ${index + 1}</strong><small>${isCancelled ? 'Cancelada' : `Saldo ${formatMoney(card.balance)}`}</small>`;
    list.append(chip);
  });
}

export function mount() {
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
        { name: 'principal', label: 'Capital prestado ($)', type: 'number', min: 0, step: 1, value: inferClientPrincipal(client), required: true },
        { name: 'total', label: 'Valor total del crédito ($)', type: 'number', min: 0, step: 1, value: client.total, required: true },
        { name: 'balance', label: 'Saldo pendiente ($)', type: 'number', min: 0, step: 1, value: client.balance, required: true },
        { name: 'installment', label: 'Valor de cuota ($)', type: 'number', min: 0, step: 1, value: client.installment, required: true },
        { name: 'interestPercent', label: 'Interés (%)', type: 'number', min: 0, step: 0.1, value: client.interestPercent ?? 20, required: true },
        { name: 'insuranceAmount', label: `Seguros cobrados ($) · general: ${formatMoney(generalInsuranceAmount(inferClientPrincipal(client)))}`, type: 'number', min: 0, step: 1, value: clientInsurance(client).amount, required: true },
        { name: 'insuranceReason', label: 'Motivo si los seguros son diferentes al 10%', type: 'textarea', rows: 2, value: clientInsurance(client).reason },
        { name: 'paid', label: 'Cuotas pagadas', type: 'number', min: 0, step: 1, value: client.paid, required: true },
        { name: 'installments', label: 'Total de cuotas', type: 'number', min: 1, step: 1, value: client.installments, required: true },
        { name: 'routeDay', label: 'Día actual del crédito', type: 'number', min: 1, step: 1, value: client.routeDay, required: true },
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
        client.routeDay = Number(values.routeDay);
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
        fields: [{ name: 'amount', label: 'Monto del abono', money: true, type: 'number', min: 1, step: 1, value: client.payments[index].amount, required: true }],
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
