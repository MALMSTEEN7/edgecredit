/**
 * features/clients/new-client · Alta de clientes, renovación de créditos, seguros
 * (10% general o valor propio con motivo) y solicitudes de excepción de interés.
 */

import { paymentFrequencyDays } from '../../core/config.js';
import { customModal, interestModal, modal, newClientError, newClientForm, newClientModal, routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, pendingRequests, persistBusinessData, routeSettlements } from '../../core/store.js';
import { renderAdminRoute } from '../admin/admin-shell.js';
import { renderPendingRequests } from '../admin/pending.js';
import { renderRouteOperations } from '../admin/settlement.js';
import { appendClientCards, renderClientRows } from './directory.js';
import { addToWorkBase, deductWorkBase, renderWorkerDailyMetrics } from '../worker/cash-box.js';
import { generalInsuranceAmount, resolveInsurance } from '../../domain/insurance.js';
import { MAX_ACTIVE_CARDS_PER_PERSON, activeCardIds, canAddCard, personCardIds, personKey } from '../../domain/person-cards.js';
import { localDateISO } from '../../shared/dates.js';
import { formatMoney, normalizeSearch } from '../../shared/format.js';
import { compressClientPhoto } from '../../shared/media.js';
import { LOCATION_FAILURE_LABELS, hasCoordinates, isApproximateLocation, locateDevice } from '../../shared/geo.js';
import { showToast } from '../../ui/toast.js';

// Cartulina de origen cuando el modal está en modo «Renovar crédito» (linkMode 'renew')
// o «Otra cartulina» para la misma persona (linkMode 'extra').
let renewSourceId = null;
let linkMode = null;

// ── Posición del nuevo cliente en la ruta (antes / después de otro cliente) ──
let positionRefId = null;

function positionRouteId() {
  return state.userRole === 'admin' ? routeSelect.value : state.workerRoute;
}

/** Orden actual de la ruta: el guardado por el trabajador y luego los demás clientes del cobro. */
function currentRouteOrder(routeId) {
  const ids = Object.keys(clients).filter(id => clients[id].route === routeId);
  const saved = (state.clientLibraryOrder[routeId] || []).filter(id => ids.includes(id));
  return [...saved, ...ids.filter(id => !saved.includes(id))];
}

function renderPositionResults() {
  const results = document.querySelector('#route-position-results');
  results.replaceChildren();
  const term = normalizeSearch(document.querySelector('#route-position-search').value.trim());
  if (!term) return;
  const routeId = positionRouteId();
  const order = currentRouteOrder(routeId);
  const matches = order.filter(id => Number(clients[id].balance) > 0 && normalizeSearch(`${clients[id].name} ${clients[id].id}`).includes(term)).slice(0, 6);
  if (!matches.length) {
    results.append(Object.assign(document.createElement('p'), { className: 'route-position-empty', textContent: 'No hay clientes con ese nombre o cédula en este cobro.' }));
    return;
  }
  matches.forEach(id => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'route-position-option';
    option.setAttribute('role', 'option');
    option.dataset.positionClient = id;
    const name = document.createElement('strong');
    name.textContent = clients[id].name;
    const meta = document.createElement('small');
    meta.textContent = `#${order.indexOf(id) + 1} en la ruta · Cédula ${clients[id].id}`;
    option.append(name, meta);
    results.append(option);
  });
}

function selectPosition(id) {
  positionRefId = id;
  const selected = document.querySelector('#route-position-selected');
  selected.hidden = !id;
  document.querySelector('#route-position-name').textContent = id ? clients[id].name : '';
  document.querySelector('#route-position-search').value = '';
  document.querySelector('#route-position-results').replaceChildren();
  document.querySelector('.route-position-search').hidden = Boolean(id);
}

/** Inserta al cliente nuevo en el orden de la ruta, antes o después del elegido. */
function placeInRoute(routeId, clientId) {
  if (!positionRefId || !clients[positionRefId] || clients[positionRefId].route !== routeId) return;
  const where = document.querySelector('input[name="routePositionWhere"]:checked')?.value === 'before' ? 'before' : 'after';
  const order = currentRouteOrder(routeId).filter(id => id !== clientId);
  const index = order.indexOf(positionRefId);
  order.splice(where === 'before' ? index : index + 1, 0, clientId);
  state.clientLibraryOrder[routeId] = order;
}

function setAltAddressOpen(open) {
  const toggle = document.querySelector('#toggle-alt-address');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.classList.toggle('is-open', open);
  toggle.innerHTML = open ? '<span aria-hidden="true">−</span> Quitar dirección alternativa' : '<span aria-hidden="true">＋</span> Dirección alternativa';
  document.querySelector('#alt-address-field').hidden = !open;
  const input = document.querySelector('#alt-address-input');
  input.required = open;
  if (!open) input.value = '';
  else window.setTimeout(() => input.focus(), 20);
}

function updateInsurancePreview() {
  const principal = Number(newClientForm.elements.principal.value) || 0;
  document.querySelector('#insurance-general-amount').textContent = formatMoney(generalInsuranceAmount(principal));
}

function setInsuranceCustom(open) {
  document.querySelector('#insurance-custom-toggle').checked = open;
  document.querySelector('#insurance-custom-fields').hidden = !open;
  document.querySelector('#insurance-custom-amount').required = open;
  document.querySelector('#insurance-custom-reason').required = open;
  if (open) window.setTimeout(() => document.querySelector('#insurance-custom-amount').focus(), 20);
}

const LINK_COPY = {
  renew: { title: 'Renovar crédito', kind: 'RENOVACIÓN', submit: 'Renovar crédito', description: 'La cartulina anterior ya está cancelada. Se crea una nueva con los mismos datos: elige el nuevo monto y, si cambió, actualiza la dirección.' },
  extra: { title: 'Otra cartulina', kind: 'CARTULINA ADICIONAL', submit: 'Crear cartulina', description: 'Se abre un crédito adicional a nombre de la misma persona. Las demás cartulinas siguen activas y se cobran por separado.' },
};

/**
 * Activa el modo vinculado a una cartulina existente (renovar u otra cartulina):
 * identidad fija, sin foto nueva (se usa la registrada) y sin elegir posición.
 */
function setLinkedMode(sourceId, mode) {
  renewSourceId = sourceId;
  linkMode = sourceId ? mode : null;
  const linked = Boolean(linkMode);
  const copy = LINK_COPY[linkMode];
  ['name', 'idNumber', 'phone'].forEach(name => { newClientForm.elements[name].readOnly = linked; });
  document.querySelector('#client-photo-input').required = !linked;
  document.querySelector('.client-photo-field').hidden = linked;
  document.querySelector('.route-position-field').hidden = linked;
  document.querySelector('#new-client-title').textContent = copy?.title || 'Registrar cliente';
  document.querySelector('#new-client-kind').textContent = copy?.kind || 'NUEVO CRÉDITO';
  document.querySelector('#new-client-submit').innerHTML = `${copy?.submit || 'Crear cliente'} <span aria-hidden="true">→</span>`;
  document.querySelector('#new-client-description').textContent = copy?.description || 'Las excepciones de interés quedan pendientes de aprobación del administrador.';
  const linkedPhoto = document.querySelector('#linked-photo');
  const note = document.querySelector('#renewal-note');
  linkedPhoto.hidden = true;
  note.hidden = true;
  if (!linked) return;
  const source = clients[sourceId];
  const photo = document.querySelector('#linked-photo-img');
  if (source.photoData) photo.src = source.photoData; else photo.removeAttribute('src');
  photo.hidden = !source.photoData;
  document.querySelector('#linked-photo-text').textContent = source.photoData
    ? 'Se usa la foto ya registrada de esta persona.'
    : 'Esta persona no tiene foto registrada; puede agregarse luego desde «Editar cliente».';
  linkedPhoto.hidden = false;
  if (linkMode === 'extra') {
    const active = activeCardIds(clients, source.id).length;
    note.hidden = false;
    note.textContent = `${source.name} tiene ${active} cartulina${active === 1 ? '' : 's'} activa${active === 1 ? '' : 's'}. Esta será la ${active + 1} de máximo ${MAX_ACTIVE_CARDS_PER_PERSON}.`;
  }
}

function openNewClientModal() {
  if (state.userRole !== 'worker' && state.userRole !== 'admin') return;
  newClientError.textContent = '';
  newClientForm.reset();
  document.querySelector('#client-photo-preview').hidden = true;
  document.querySelector('#client-photo-preview').removeAttribute('src');
  const isAdmin = state.userRole === 'admin';
  // La ruta la define el cobro abierto (admin: el seleccionado; trabajador: el suyo).
  const openRoute = routeSettlements[isAdmin ? routeSelect.value : state.workerRoute];
  document.querySelector('#new-client-route').textContent = `RUTA ${(openRoute?.name || '').toLocaleUpperCase('es')}`;
  // El admin fija interés y seguros directamente: no necesita "solicitar excepciones".
  document.querySelector('#default-rate-note').hidden = isAdmin;
  document.querySelector('#admin-rate-fields').hidden = !isAdmin;
  document.querySelector('#admin-interest-percent').required = isAdmin;
  document.querySelector('#interest-exception-toggle-wrap').hidden = isAdmin;
  document.querySelector('#interest-worker-comment-wrap').hidden = isAdmin;
  document.querySelector('#interest-admin-value-wrap').hidden = !isAdmin;
  document.querySelector('#admin-no-base-impact-wrap').hidden = !isAdmin;
  document.querySelector('#interest-exception-fields').hidden = true;
  document.querySelector('#interest-exception-value').required = false;
  document.querySelector('#interest-exception-comment').required = false;
  setAltAddressOpen(false);
  selectPosition(null);
  setInsuranceCustom(false);
  setLinkedMode(null);
  updateInsurancePreview();
  newClientModal.hidden = false;
  newClientModal.classList.add('active');
  document.body.classList.add('modal-open');
  window.setTimeout(() => newClientForm.querySelector('input')?.focus(), 20);
}

/** Renovar: solo cuando la cartulina está cancelada (saldo en cero) y no se ha renovado antes. */
export function canRenew(clientId) {
  const client = clients[clientId];
  return Boolean(client) && Number(client.balance) <= 0 && !(client.renewedTo && clients[client.renewedTo]);
}

export function openRenewalModal(sourceId) {
  if (!canRenew(sourceId)) {
    const source = clients[sourceId];
    showToast(source && Number(source.balance) > 0
      ? `Para renovar, primero hay que pagar lo que falta de esta cartulina: ${formatMoney(source.balance)}. Si necesita otro préstamo sin cancelar, usa «＋ Otra cartulina».`
      : 'Esta cartulina ya fue renovada.');
    return;
  }
  openLinkedModal(sourceId, 'renew');
}

/** Otra cartulina simultánea para la misma persona (hasta el máximo permitido). */
export function openExtraCardModal(sourceId) {
  const source = clients[sourceId];
  if (!source) return;
  if (!canAddCard(clients, source.id)) {
    showToast(`${source.name} ya tiene ${MAX_ACTIVE_CARDS_PER_PERSON} cartulinas activas, el máximo permitido.`);
    return;
  }
  openLinkedModal(sourceId, 'extra');
}

function openLinkedModal(sourceId, mode) {
  const source = clients[sourceId];
  if (!source) return;
  openNewClientModal();
  setLinkedMode(sourceId, mode);
  const routeName = routeSettlements[source.route]?.name || source.route;
  document.querySelector('#new-client-route').textContent = `RUTA ${String(routeName).toLocaleUpperCase('es')}`;
  const fields = newClientForm.elements;
  fields.name.value = source.name;
  fields.idNumber.value = source.id;
  fields.phone.value = source.phone;
  fields.address.value = source.address || '';
  fields.addressNotes.value = source.addressNotes || '';
  fields.totalDays.value = source.totalDays || '';
  fields.frequency.value = paymentFrequencyDays[source.frequency] ? source.frequency : 'weekly';
  if (source.altAddress) { setAltAddressOpen(true); document.querySelector('#alt-address-input').value = source.altAddress; }
  if (state.userRole === 'admin') document.querySelector('#admin-interest-percent').value = source.interestPercent ?? 20;
  updateInsurancePreview();
  window.setTimeout(() => fields.principal.focus(), 30);
}

export function closeNewClientModal() {
  newClientModal.hidden = true;
  newClientModal.classList.remove('active');
  newClientForm.reset();
  document.querySelector('#client-photo-preview').hidden = true;
  document.querySelector('#client-photo-preview').removeAttribute('src');
  document.querySelector('#client-photo-file-name').textContent = 'Ningún archivo seleccionado';
  setLinkedMode(null);
  if (customModal.hidden && interestModal.hidden && modal.hidden) document.body.classList.remove('modal-open');
}

/**
 * `gps`: resultado de locateDevice() tomado al pulsar crear, o null si no se pidió
 * (admin, o renovación sin cambio de dirección que conserva la ubicación anterior).
 */
function addNewClient(values, photoData = '', insurance, gps = null) {
  const clientId = `client-${Date.now()}`;
  const principal = Math.round(Number(values.principal));
  const interestException = document.querySelector('#interest-exception-toggle').checked;
  const isAdmin = state.userRole === 'admin';
  const source = renewSourceId ? clients[renewSourceId] : null;
  const mode = source ? linkMode : null;
  const interestPercent = isAdmin ? Number(values.adminInterestPercent) : 20;
  const today = localDateISO();
  const total = Math.round(principal * (1 + interestPercent / 100));
  const name = values.name.trim();
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const totalDays = Math.max(1, Math.round(Number(values.totalDays)));
  const frequency = paymentFrequencyDays[values.frequency] ? values.frequency : 'weekly';
  const installments = Math.max(1, Math.ceil(totalDays / paymentFrequencyDays[frequency]));
  const assignedRoute = source ? source.route : isAdmin ? routeSelect.value : state.workerRoute;
  const route = routeSettlements[assignedRoute];
  const noBaseImpact = isAdmin && document.querySelector('#admin-no-base-impact').checked;
  clients[clientId] = {
    name, initials, route: assignedRoute, balance: total, principal, installment: Math.ceil(total / installments),
    status: 'Al día', late: false, id: values.idNumber.trim(), address: values.address.trim(), altAddress: (values.altAddress || '').trim(), addressHistory: [], phone: values.phone.trim(),
    total, term: `${totalDays} días`, breakdown: `${formatMoney(principal)} / ${formatMoney(total - principal)}`,
    paid: 0, installments, progress: 0, routeDay: 1, totalDays, generalInterest: 0,
    interestPercent, insurancePercent: null, insuranceAmount: insurance.amount, insuranceCustom: insurance.custom, insuranceReason: insurance.reason, insuranceCollectedAt: today, insuranceCollectedTs: Date.now(),
    addressNotes: (values.addressNotes || '').trim(), notes: '', notesUpdatedAt: null, notesUpdatedBy: null, payments: [], interestHistory: [], noBaseImpact,
    frequency, creditStartDate: today, visitHistory: [], paymentWarning: false, paidPeriodIndexes: [], schedulePaidBaseline: 0, photoData, totalPaidAmount: 0, settledAt: null
  };
  const created = clients[clientId];
  if (source) {
    // Renovación: se heredan foto, notas, ubicaciones e historial; si la dirección cambió,
    // la anterior pasa al historial y la ubicación se vuelve a tomar.
    const changedAt = new Date().toISOString();
    const by = isAdmin ? 'Administrador' : state.activeWorker?.name || 'Trabajador';
    created.photoData = photoData || source.photoData || '';
    created.notes = source.notes || '';
    created.notesUpdatedAt = source.notesUpdatedAt || null;
    created.notesUpdatedBy = source.notesUpdatedBy || null;
    created.addressHistory = [...(source.addressHistory || [])];
    if (created.address === source.address) created.location = source.location || null;
    else created.addressHistory.push({ type: 'principal', address: source.address, replacedBy: created.address, location: source.location || null, changedAt, changedBy: by });
    if (created.altAddress === (source.altAddress || '')) created.altLocation = source.altLocation || null;
    else if (source.altAddress) created.addressHistory.push({ type: 'alternativa', address: source.altAddress, replacedBy: created.altAddress || '(eliminada)', location: source.altLocation || null, changedAt, changedBy: by });
    if (mode === 'renew') {
      created.renewedFrom = renewSourceId;
      created.renewalCount = (Number(source.renewalCount) || 0) + 1;
      source.renewedTo = clientId;
      source.renewedAt = today;
    }
    // Renovación: ocupa el lugar de la anterior. Otra cartulina: va después de la última
    // cartulina de la persona, para cobrarlas en la misma visita.
    const order = currentRouteOrder(assignedRoute).filter(id => id !== clientId);
    const siblings = personCardIds(clients, source.id).filter(id => id !== clientId && order.includes(id));
    const anchor = mode === 'extra' ? siblings.sort((a, b) => order.indexOf(a) - order.indexOf(b)).pop() || renewSourceId : renewSourceId;
    const index = order.indexOf(anchor);
    order.splice(index < 0 ? order.length : index + 1, 0, clientId);
    state.clientLibraryOrder[assignedRoute] = order;
  } else placeInRoute(assignedRoute, clientId);
  appendClientCards(clientId);
  if (source) personCardIds(clients, source.id).forEach(id => { if (id !== clientId) renderClientRows(id); });
  // El trabajador registra al cliente en su domicilio: esa posición (con su precisión y
  // fecha) va al mismo campo que usa el mapa. Sin ubicación, queda marcado para tomarla
  // después desde la ficha.
  if (gps && !hasCoordinates(created.location)) {
    if (gps.location) created.location = { ...gps.location, source: 'alta' };
    else {
      created.location = null;
      created.locationPending = true;
      created.locationFailure = gps.reason;
    }
  }
  const requests = [];
  if (!isAdmin && interestException) {
    requests.push({ type: 'interest', comment: values.interestComment.trim() });
  }
  requests.forEach(request => pendingRequests.push({
    id: `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...request, clientId, clientName: name, workerId: state.activeWorker.id, workerName: state.activeWorker.name,
    route: isAdmin ? route?.name : state.activeWorker.route, routeId: assignedRoute, createdAt: new Date().toISOString(), status: 'pending'
  }));
  if (route) {
    if (!noBaseImpact) route.base -= principal;
    route.loans += principal;
    route.loansNew.unshift({ name, clientId, amount: principal });
    route.loansEntered.unshift({ name, clientId, amount: total });
    // Los seguros se reciben en efectivo al entregar el préstamo: entran a la base del día.
    route.base += insurance.amount;
    route.monthlyInsurance = (Number(route.monthlyInsurance) || 0) + insurance.amount;
    if (!isAdmin && !noBaseImpact) {
      deductWorkBase(principal);
    }
    if (!isAdmin) addToWorkBase(insurance.amount);
    if (routeSelect.value === assignedRoute) renderAdminRoute(assignedRoute);
    if (state.workerRoute === assignedRoute) renderRouteOperations(route);
  }
  persistBusinessData();
  renderPendingRequests();
  renderWorkerDailyMetrics();
  closeNewClientModal();
  const insuranceCopy = `Seguros ${formatMoney(insurance.amount)}${insurance.custom ? ' (valor especial)' : ''}.`;
  const lead = mode === 'renew' ? `Crédito renovado para ${name}.` : mode === 'extra' ? `Nueva cartulina creada para ${name}.` : isAdmin ? 'Cartulina creada para la ruta seleccionada.' : 'Cliente creado con el interés predeterminado del 20%.';
  const requestsCopy = requests.length ? ` ${requests.length} solicitud(es) enviada(s) a Pendientes.` : '';
  if (gps && !gps.location) {
    showToast(`Cartulina creada sin ubicación (${LOCATION_FAILURE_LABELS[gps.reason] || 'sin GPS'}). Tómala después desde la ficha del cliente.${requestsCopy}`);
  } else if (gps && isApproximateLocation(created.location)) {
    showToast(`${lead} Ubicación aproximada (± ${created.location.accuracy} m): revísala en el mapa.${requestsCopy}`);
  } else showToast(`${lead} ${insuranceCopy}${requestsCopy}`);
  return clientId;
}

// El detalle del cliente se registra aquí para abrir la cartulina nueva tras renovar
// (evita una importación circular new-client ↔ client-detail).
let onRenewed = null;
let creatingClient = false; // evita crear dos veces si pulsan «Crear» mientras se toma la ubicación
export function onClientRenewed(callback) { onRenewed = callback; }

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#route-position-search').addEventListener('input', renderPositionResults);
  document.querySelector('#route-position-results').addEventListener('click', event => {
    const option = event.target.closest('[data-position-client]');
    if (option) selectPosition(option.dataset.positionClient);
  });
  document.querySelector('#route-position-clear').addEventListener('click', () => { selectPosition(null); document.querySelector('#route-position-search').focus(); });
  document.querySelector('#toggle-alt-address').addEventListener('click', () => setAltAddressOpen(document.querySelector('#toggle-alt-address').getAttribute('aria-expanded') !== 'true'));
  document.querySelector('#admin-add-client').addEventListener('click', openNewClientModal);
  document.querySelector('#add-client').addEventListener('click', openNewClientModal);
  document.querySelector('#renew-client').addEventListener('click', () => openRenewalModal(state.activeClient));
  document.querySelector('#extra-card-client').addEventListener('click', () => openExtraCardModal(state.activeClient));
  document.querySelector('#client-photo-input').addEventListener('change', event => {
    const preview = document.querySelector('#client-photo-preview');
    const file = event.target.files?.[0];
    document.querySelector('#client-photo-file-name').textContent = file?.name || 'Ningún archivo seleccionado';
    if (!file) { preview.hidden = true; preview.removeAttribute('src'); return; }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
  document.querySelector('#new-client-close').addEventListener('click', closeNewClientModal);
  document.querySelector('#new-client-cancel').addEventListener('click', closeNewClientModal);
  document.querySelector('#interest-exception-toggle').addEventListener('change', event => {
    const fields = document.querySelector('#interest-exception-fields');
    fields.hidden = !event.target.checked;
    document.querySelector('#interest-exception-comment').required = event.target.checked && state.userRole === 'worker';
    document.querySelector('#interest-exception-value').required = event.target.checked && state.userRole === 'admin';
  });
  document.querySelector('#insurance-custom-toggle').addEventListener('change', event => setInsuranceCustom(event.target.checked));
  newClientForm.elements.principal.addEventListener('input', updateInsurancePreview);
  newClientModal.addEventListener('click', event => { if (event.target === newClientModal) closeNewClientModal(); });
  newClientForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!newClientForm.reportValidity()) return;
    const values = Object.fromEntries(new FormData(newClientForm).entries());
    const linked = Boolean(renewSourceId && clients[renewSourceId] && linkMode);
    if (!linked && Object.values(clients).some(client => personKey(client.id) === personKey(values.idNumber))) {
      newClientError.textContent = 'Esa cédula ya está registrada. Para darle otro crédito, abre su ficha y usa «＋ Otra cartulina» (o «Renovar» si ya canceló).';
      return;
    }
    const interestException = document.querySelector('#interest-exception-toggle').checked;
    if (state.userRole === 'admin' && (!Number.isFinite(Number(values.adminInterestPercent)) || Number(values.adminInterestPercent) < 0 || Number(values.adminInterestPercent) > 100)) {
      newClientError.textContent = 'El porcentaje acordado debe estar entre 0 y 100.';
      return;
    }
    const insurance = resolveInsurance(values.principal, document.querySelector('#insurance-custom-toggle').checked, values.insuranceAmount, values.insuranceReason);
    if (insurance.error) {
      newClientError.textContent = insurance.error;
      return;
    }
    if (creatingClient) return;
    creatingClient = true;
    const submit = document.querySelector('#new-client-submit');
    const submitLabel = submit.innerHTML;
    try {
      const photoData = await compressClientPhoto(document.querySelector('#client-photo-input').files?.[0]);
      const sourceId = renewSourceId;
      // GPS solo del trabajador (está en el domicilio). Una renovación con la misma dirección
      // conserva la ubicación que ya tenía.
      const source = linked ? clients[renewSourceId] : null;
      const keepsLocation = source && values.address.trim() === (source.address || '') && hasCoordinates(source.location);
      let gps = null;
      if (state.userRole === 'worker' && !keepsLocation) {
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        submit.textContent = 'Tomando ubicación…';
        gps = await locateDevice({ timeout: 10000 });
        if (newClientModal.hidden) return; // lo cancelaron mientras se tomaba la ubicación
      }
      const createdId = addNewClient(values, photoData, insurance, gps);
      if (sourceId && createdId && state.activeClient === sourceId) onRenewed?.(createdId);
    } catch (error) { newClientError.textContent = error.message || 'No se pudo procesar la foto.'; }
    finally {
      creatingClient = false;
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.innerHTML = submitLabel;
    }
  });
}
