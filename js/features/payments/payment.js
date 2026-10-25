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
import { formatMoney } from '../../shared/format.js';
import { compressClientPhoto } from '../../shared/media.js';
import { showToast } from '../../ui/toast.js';
import { showView } from '../../ui/navigation.js';
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
  updatePaymentMethod();
  window.setTimeout(() => amountInput.focus(), 40);
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

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelectorAll('[data-open-payment]').forEach(button => button.addEventListener('click', openPayment));
  document.querySelectorAll('[data-close-payment]').forEach(button => button.addEventListener('click', closePayment));
  document.querySelectorAll('input[name="method"]').forEach(input => input.addEventListener('change', updatePaymentMethod));
  modal.addEventListener('click', event => { if (event.target === modal) closePayment(); });
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
    const paidDate = localDateISO();
    const cycleIndex = paymentCycleIndex(client, paidDate);
    let receiptData = '';
    try { receiptData = paymentMethod === 'transfer' ? await compressClientPhoto(chosenVoucher()) : ''; }
    catch (error) { showToast(error.message || 'No se pudo procesar el comprobante.'); return; }
    client.payments.unshift({
      date: paidDate,
      amount,
      method: paymentMethod,
      cycleIndex,
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
    if (periodPaid) {
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
    if (route) route.collections += amount;
    // Cualquier abono de hoy cierra la visita: el cliente sale del Inicio y queda con
    // el indicador "Abono registrado" en la ruta diaria.
    closeVisit(state.activeClient, 'paid', client.route);
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
    if (returnHome) showView('inicio');
    showToast(missingTransferEvidence ? `Abono de ${formatMoney(amount)} registrado para ${client.name}. Falta adjuntar la evidencia.` : `Abono de ${formatMoney(amount)} registrado para ${client.name}.`);
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
