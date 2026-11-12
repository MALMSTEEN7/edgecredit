/**
 * features/payments · Modal de registro de abonos (efectivo / transferencia con comprobante).
 */

import { amountInput, customModal, interestModal, modal, newClientModal, paymentForm, voucherField, voucherFile } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData, routeSettlements } from '../../core/store.js';
import { addCancelledCard } from '../../domain/accounting.js';
import { paymentAmountForCycle, paymentBehavior, paymentCycleIndex, ratingSystemActive, updatePaidAmountTotal } from '../../domain/loan-schedule.js';
import { openClient, renderHistory } from '../clients/client-detail.js';
import { filterClientCards, renderClientRows } from '../clients/directory.js';
import { renderRouteBuilder, routeDayKey } from '../daily-route/daily-route.js';
import { updateCashTotal } from '../worker/cash-box.js';
import { localDateISO } from '../../shared/dates.js';
import { formatDate, formatMoney } from '../../shared/format.js';
import { syncRouteCollections } from '../../domain/ledger.js';
import { compressClientPhoto } from '../../shared/media.js';
import { showToast } from '../../ui/toast.js';
import { showView } from '../../ui/navigation.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { closeVisit } from '../daily-route/daily-route.js';

/** Comprobante elegido: captura de la galería («Subir captura») o foto («Tomar foto»). */
function chosenVoucher() {
  return voucherFile.files?.[0] || document.querySelector('#voucher-camera').files?.[0] || null;
}

export function openPayment() {
  if (state.currentView !== 'detalle-cliente') return;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  amountInput.value = '';
  voucherFile.value = '';
  document.querySelector('#voucher-camera').value = '';
  document.querySelector('#voucher-file-name').textContent = 'Ningún archivo seleccionado';
  document.querySelector('input[name="method"][value="cash"]').checked = true;
  // Solo el admin puede registrar un abono con otra fecha (p. ej. uno que se le olvidó al trabajador).
  const dateField = document.querySelector('#payment-date-field');
  const dateInput = document.querySelector('#payment-date');
  dateField.hidden = state.userRole !== 'admin';
  dateInput.max = localDateISO();
  dateInput.value = localDateISO();
  updatePaymentDateHint();
  updatePaymentMethod();
  updateBalancePreview();
  window.setTimeout(() => amountInput.focus(), 40);
}

/**
 * Debajo del monto: lo que debe el cliente ahora y en cuánto queda con el abono que se está
 * escribiendo (se actualiza con cada número).
 */
function updateBalancePreview() {
  const client = clients[state.activeClient];
  if (!client) return;
  const balance = Math.max(0, Number(client.balance) || 0);
  const amount = Math.max(0, Number(amountInput.value) || 0);
  const after = balance - amount;
  document.querySelector('#payment-balance-now').textContent = formatMoney(balance);
  const afterNode = document.querySelector('#payment-balance-after');
  afterNode.textContent = formatMoney(Math.max(0, after));
  const preview = document.querySelector('#payment-balance-preview');
  preview.classList.toggle('is-settled', amount > 0 && after === 0);
  preview.classList.toggle('is-over', after < 0);
  preview.classList.toggle('has-amount', amount > 0);
  document.querySelector('#payment-balance-after-label').textContent = amount > 0 && after === 0 ? 'Queda pagada' : 'Queda debiendo';
  const installment = Number(client.installment) || 0;
  document.querySelector('#payment-balance-note').textContent = after < 0
    ? `El abono supera la deuda por ${formatMoney(-after)}.`
    : amount > 0 && after === 0 ? 'Con este abono cancela toda la deuda.'
    : amount > 0 ? `El saldo baja ${formatMoney(amount)}.${installment ? ` Cuota: ${formatMoney(installment)}.` : ''}`
    : installment ? `Cuota: ${formatMoney(installment)}.` : '';
}

/** Fecha elegida para el abono: hoy, salvo que el admin escoja otro día. */
function chosenPaymentDate() {
  const today = localDateISO();
  if (state.userRole !== 'admin') return today;
  const value = document.querySelector('#payment-date').value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
}

function updatePaymentDateHint() {
  const date = chosenPaymentDate();
  const otherDay = date !== localDateISO();
  document.querySelector('#payment-date-field').classList.toggle('is-other-day', otherDay);
  document.querySelector('#payment-date-hint').textContent = otherDay
    ? `Quedará con fecha ${formatDate(date)}: no se suma al cobro de hoy (si ese día ya se cerró).`
    : 'Si el abono es de otro día, cámbiala: así no se suma al cobro de hoy.';
}

export function closePayment() {
  modal.hidden = true;
  if (customModal.hidden && newClientModal.hidden && interestModal.hidden) document.body.classList.remove('modal-open');
}

function updatePaymentMethod() {
  const isTransfer = document.querySelector('input[name="method"]:checked')?.value === 'transfer';
  voucherField.hidden = !isTransfer;
  voucherFile.required = false;
}

/** El abono canceló la cartulina: ¿renovar el crédito? (Renovar abre el flujo de la ficha.) */
function offerRenewal(clientId, returnHome) {
  const client = clients[clientId];
  if (!client) return;
  // Cerrar con la ✕ (o con «atrás») cuenta como «No».
  const closeButton = document.querySelector('#custom-modal-close');
  const goHome = () => { if (returnHome) showView('inicio'); };
  closeButton.addEventListener('click', goHome, { once: true });
  openCustomModal({
    title: 'Cartulina cancelada',
    description: `Con este abono ${client.name} pagó toda la deuda. ¿Desea renovarle el crédito?`,
    submitLabel: 'Sí, renovar',
    cancelLabel: returnHome ? 'No, volver al inicio' : 'No renovar',
    // Se abre después de que esta ventana se cierre, para que no la cierre a ella.
    onSubmit: () => { closeButton.removeEventListener('click', goHome); window.setTimeout(() => document.querySelector('#renew-client')?.click(), 0); },
    onCancel: () => { closeButton.removeEventListener('click', goHome); goHome(); },
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelectorAll('[data-open-payment]').forEach(button => button.addEventListener('click', openPayment));
  document.querySelectorAll('[data-close-payment]').forEach(button => button.addEventListener('click', closePayment));
  document.querySelectorAll('input[name="method"]').forEach(input => input.addEventListener('change', updatePaymentMethod));
  modal.addEventListener('click', event => { if (event.target === modal) closePayment(); });
  amountInput.addEventListener('input', updateBalancePreview);
  document.querySelector('#payment-date').addEventListener('input', updatePaymentDateHint);
  paymentForm.addEventListener('submit', async event => {
    event.preventDefault();
    const returnHome = state.paymentFromHome; // openClient() lo reinicia más abajo
    if (!paymentForm.reportValidity()) return;
    const paymentMethod = document.querySelector('input[name="method"]:checked')?.value;
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      amountInput.setCustomValidity('Ingresa un monto mayor que cero.');
      amountInput.reportValidity();
      amountInput.addEventListener('input', () => amountInput.setCustomValidity(''), { once: true });
      return;
    }
    const client = clients[state.activeClient];
    if (amount > Number(client.balance)) {
      amountInput.setCustomValidity('El abono no puede superar el saldo pendiente.');
      amountInput.reportValidity();
      amountInput.addEventListener('input', () => amountInput.setCustomValidity(''), { once: true });
      return;
    }
    const today = localDateISO();
    const paidDate = chosenPaymentDate();
    if (paidDate > today) {
      const dateInput = document.querySelector('#payment-date');
      dateInput.setCustomValidity('La fecha del abono no puede ser posterior a hoy.');
      dateInput.reportValidity();
      dateInput.addEventListener('input', () => dateInput.setCustomValidity(''), { once: true });
      return;
    }
    const isToday = paidDate === today;
    const cycleIndex = paymentCycleIndex(client, paidDate);
    let receiptData = '';
    try { receiptData = paymentMethod === 'transfer' ? await compressClientPhoto(chosenVoucher()) : ''; }
    catch (error) { showToast(error.message || 'No se pudo procesar el comprobante.'); return; }
    client.payments.unshift({
      date: paidDate,
      at: new Date().toISOString(),
      amount,
      method: paymentMethod,
      cycleIndex,
      ...(isToday ? {} : { backdated: true, registeredBy: 'Administrador' }),
      receiptName: paymentMethod === 'transfer' ? chosenVoucher()?.name || '' : '',
      receiptData
    });
    const payment = client.payments[0];
    const paidClientId = state.activeClient;
    client.archivedPaymentsAt = null;
    client.balance = Math.max(0, Number(client.balance) - amount);
    updatePaidAmountTotal(client);
    client.settledAt = Number(client.balance) <= 0 ? client.settledAt || paidDate : null;
    const periodPaid = Number(client.balance) <= 0 || paymentAmountForCycle(client, cycleIndex) > 0;
    client.paidPeriodIndexes ||= [];
    if (periodPaid && !client.paidPeriodIndexes.includes(cycleIndex)) {
      client.paidPeriodIndexes.push(cycleIndex);
      client.paid = Math.min(Number(client.installments), Number(client.paid || 0) + 1);
      client.progress = client.installments ? Math.round(client.paid / client.installments * 100) : 0;
    }
    if (!isToday) {
      // Abono de otro día: queda en su fecha y en orden; no toca la visita de hoy.
      client.payments.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.at || '').localeCompare(String(a.at || '')));
      if (periodPaid) {
        client.visitHistory = (client.visitHistory || []).filter(item => item.date !== paidDate);
        client.visitHistory.push({ date: paidDate, outcome: 'paid' });
      }
    } else if (periodPaid) {
      const todayKey = routeDayKey(client.route);
      state.routeVisitOutcomes[todayKey] ||= {};
      state.routeVisitOutcomes[todayKey][state.activeClient] = 'paid';
      client.visitHistory ||= [];
      client.visitHistory = client.visitHistory.filter(item => item.date !== paidDate);
      client.visitHistory.push({ date: paidDate, outcome: 'paid' });
    } else if (state.routeVisitOutcomes[routeDayKey(client.route)]?.[state.activeClient] === 'no-payment') {
      state.routeVisitOutcomes[routeDayKey(client.route)][state.activeClient] = 'partial';
      client.visitHistory = (client.visitHistory || []).filter(item => item.date !== paidDate);
      client.visitHistory.push({ date: paidDate, outcome: 'partial' });
    }
    const paymentRisk = paymentBehavior(client);
    // Con la calificación por puntos la demora la mide el calendario (domain/loan-schedule).
    if (!ratingSystemActive()) client.paymentWarning ||= paymentRisk.overdueDays > 0 || paymentRisk.explicitlyMissed || paymentRisk.latePaid;
    const route = routeSettlements[client.route];
    if (route) syncRouteCollections(clients, { [client.route]: route }); // el cobro se calcula de los abonos
    // Cualquier abono de hoy cierra la visita: el cliente sale del Inicio y queda con
    // el indicador "Abono registrado" en la ruta diaria.
    if (isToday) closeVisit(state.activeClient, 'paid', client.route);
    if (Number(client.balance) <= 0) {
      client.paid = Number(client.installments) || client.paid;
      addCancelledCard(client, state.activeClient, paidDate);
      const todayKey = routeDayKey(client.route);
      state.routeVisitOutcomes[todayKey] ||= {};
      state.routeVisitOutcomes[todayKey][state.activeClient] = 'paid';
      client.visitHistory ||= [];
      client.visitHistory = client.visitHistory.filter(item => item.date !== paidDate);
      client.visitHistory.push({ date: paidDate, outcome: 'paid' });
    }
    const missingTransferEvidence = paymentMethod === 'transfer' && !chosenVoucher();
    updateCashTotal(); // caja del día (efectivo/bancos) y resumen del día
    persistBusinessData();
    closePayment();
    renderHistory(client);
    renderRouteBuilder();
    filterClientCards();
    renderClientRows(state.activeClient);
    const backView = state.previousView;
    openClient(state.activeClient);
    state.previousView = backView;
    // Si con este abono pagó toda la deuda, se pregunta si desea renovar; si no, se cierra y
    // (si el abono se hizo desde el Inicio) se vuelve al Inicio.
    if (Number(client.balance) <= 0) offerRenewal(state.activeClient, returnHome);
    else if (returnHome) showView('inicio');
    const dateNote = isToday ? '' : ` con fecha ${formatDate(paidDate)}`;
    showToast(missingTransferEvidence ? `Abono de ${formatMoney(amount)} registrado${dateNote} para ${client.name}. Falta adjuntar la evidencia.` : `Abono de ${formatMoney(amount)} registrado${dateNote} para ${client.name}.`);
  });
  const voucherCamera = document.querySelector('#voucher-camera');
  // Las dos formas son excluyentes: la última que se usó es el comprobante.
  voucherCamera.addEventListener('change', () => {
    if (voucherCamera.files?.length) voucherFile.value = '';
    document.querySelector('#voucher-file-name').textContent = voucherCamera.files?.[0] ? `Foto tomada: ${voucherCamera.files[0].name}` : 'Ningún archivo seleccionado';
  });
  voucherFile.addEventListener('change', () => {
    if (voucherFile.files?.length) voucherCamera.value = '';
    document.querySelector('#voucher-file-name').textContent = voucherFile.files?.[0]?.name || 'Ningún archivo seleccionado';
  });
}
