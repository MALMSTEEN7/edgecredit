/**
 * features/admin/pending · Bandeja de solicitudes del equipo (aprobar / rechazar).
 */

import { customModalError, pendingList, routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, pendingRequests, persistBusinessData, routeSettlements } from '../../core/store.js';
import { syncCancelledCard } from '../../domain/accounting.js';
import { paymentCycleIndex, updatePaidAmountTotal } from '../../domain/loan-schedule.js';
import { financeCard, recordRetanqueoInRoute, retanqueoCard } from '../../domain/restructure.js';
import { renderAdminRoute } from './admin-shell.js';
import { openClient, renderHistory } from '../clients/client-detail.js';
import { renderClientRows } from '../clients/directory.js';
import { renderRouteBuilder } from '../daily-route/daily-route.js';
import { formatDate, formatMoney, routeKey } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';

const REQUEST_TITLES = { interest: 'Excepción de interés', insurance: 'Excepción de seguros', 'route-correction': 'Corrección de visita o pago', finance: 'Solicitud de financiación', retanqueo: 'Solicitud de retanqueo' };

/** Lo que pidió el trabajador al financiar o retanquear, en una línea. */
function restructureSummary(request) {
  const p = request.params || {};
  if (request.type === 'finance') return `Saldo ${formatMoney(p.balance)} · interés de financiación ${formatMoney(p.interest)}${p.percent != null ? ` (${p.percent} %)` : ''} · plazo nuevo ${p.totalDays} días · saldo nuevo ${formatMoney(Number(p.balance) + Number(p.interest))}`;
  return `Saldo ${formatMoney(p.balance)} · prestar ${formatMoney(p.extra)} más · intereses ${formatMoney(p.interest)} · seguros ${formatMoney(p.insurance)} · plazo nuevo ${p.totalDays} días · saldo nuevo ${formatMoney(Number(p.balance) + Number(p.extra) + Number(p.interest))}`;
}

/** Aplica una financiación o un retanqueo aprobado con los parámetros del trabajador. */
function applyRestructureRequest(request) {
  const client = clients[request.clientId];
  const p = request.params || {};
  if (!client || Number(client.balance) <= 0) return 'La cartulina ya no tiene saldo: no se puede aplicar.';
  const by = `Administrador (solicitó ${request.workerName})`;
  if (request.type === 'finance') financeCard(client, { interest: Number(p.interest), totalDays: Number(p.totalDays), by });
  else {
    const values = { extra: Number(p.extra), interest: Number(p.interest), insurance: Number(p.insurance) };
    retanqueoCard(client, { ...values, totalDays: Number(p.totalDays), by });
    recordRetanqueoInRoute(routeSettlements[client.route], client, request.clientId, values);
  }
  return '';
}

export function renderPendingRequests() {
  pendingList.replaceChildren();
  const selectedRoute = routeSelect.value;
  const openRequests = pendingRequests.filter(request => request.status === 'pending' && routeKey(request.routeId || request.route) === selectedRoute);
  document.querySelector('#pending-count').textContent = String(openRequests.length);
  if (!openRequests.length) {
    const empty = document.createElement('p');
    empty.className = 'pending-empty';
    empty.textContent = `No hay solicitudes pendientes para la ruta ${routeSettlements[selectedRoute]?.name || selectedRoute}.`;
    pendingList.append(empty);
    return;
  }
  openRequests.forEach(request => {
    const card = document.createElement('article');
    card.className = 'pending-card';
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = REQUEST_TITLES[request.type] || 'Solicitud';
    const details = document.createElement('p');
    details.textContent = `${request.clientName} · ${routeSettlements[request.routeId || routeKey(request.route)]?.name || request.route} · Solicitó ${request.workerName}`;
    const value = document.createElement('p');
    value.className = 'pending-comment';
    value.textContent = request.type === 'finance' || request.type === 'retanqueo' ? restructureSummary(request) : `${request.type === 'route-correction' ? 'Motivo enviado' : 'Acuerdo informado'}: ${request.comment || 'Sin comentario'}`;
    copy.append(title, details, value);
    const actions = document.createElement('div');
    actions.className = 'pending-actions';
    [['approve', 'Aprobar'], ['reject', 'Rechazar']].forEach(([action, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.pendingAction = action;
      button.dataset.pendingId = request.id;
      button.className = action === 'approve' ? 'primary-button' : 'secondary-button';
      button.textContent = label;
      actions.append(button);
    });
    card.append(copy, actions);
    pendingList.append(card);
  });
}

function resolvePendingRequest(requestId, approved, approvedValue) {
  const request = pendingRequests.find(item => item.id === requestId && item.status === 'pending');
  if (!request) return;
  if (approved && (request.type === 'finance' || request.type === 'retanqueo')) {
    const error = applyRestructureRequest(request);
    if (error) { showToast(error); return; }
    request.status = 'approved';
    request.resolvedAt = new Date().toISOString();
  } else if (approved && request.type === 'route-correction') {
    const client = clients[request.clientId];
    if (client) {
      const key = `${routeKey(request.routeId || client.route)}:${request.visitDate}`;
      state.routeVisitOutcomes[key] ||= {};
      const correctedAmount = Number(approvedValue);
      const payment = (client.payments || []).find(item => item.date === request.visitDate);
      let collectionDelta = correctedAmount;
      if (payment) {
        collectionDelta = correctedAmount - Number(payment.amount);
        client.balance = Math.max(0, Number(client.balance) + Number(payment.amount) - correctedAmount);
        payment.amount = correctedAmount;
      } else {
        client.payments ||= [];
        client.payments.unshift({ date: request.visitDate, amount: correctedAmount, method: 'cash', cycleIndex: paymentCycleIndex(client, request.visitDate), correction: true });
        client.balance = Math.max(0, Number(client.balance) - correctedAmount);
      }
      const route = routeSettlements[client.route];
      if (route) route.collections = Math.max(0, Number(route.collections || 0) + collectionDelta);
      updatePaidAmountTotal(client);
      client.settledAt = Number(client.balance) <= 0 ? client.settledAt || request.visitDate : null;
      state.routeVisitOutcomes[key][request.clientId] = 'paid';
      client.visitHistory ||= [];
      client.visitHistory = client.visitHistory.filter(item => item.date !== request.visitDate);
      client.visitHistory.push({ date: request.visitDate, outcome: 'paid' });
      syncCancelledCard(client, request.clientId, request.visitDate);
    }
    request.status = 'approved';
  } else if (approved) {
    const client = clients[request.clientId];
    if (client) {
      if (request.type === 'interest') {
        client.interestPercent = approvedValue;
        client.total = Math.round(client.principal * (1 + approvedValue / 100));
        client.balance = client.total;
        client.installment = Math.ceil(client.total / client.installments);
        client.breakdown = `${formatMoney(client.principal)} / ${formatMoney(client.total - client.principal)}`;
      } else client.insurancePercent = approvedValue;
    }
    request.status = 'approved';
  } else request.status = 'rejected';
  persistBusinessData();
  renderPendingRequests();
  if (request.type === 'finance' || request.type === 'retanqueo') {
    renderClientRows(request.clientId);
    if (request.clientId === state.activeClient && state.currentView === 'detalle-cliente') openClient(request.clientId);
    renderAdminRoute(routeSelect.value);
  }
  if (request.type === 'route-correction') {
    renderRouteBuilder();
    renderClientRows(request.clientId);
    if (request.clientId === state.activeClient && state.currentView === 'detalle-cliente') {
      openClient(request.clientId);
      renderHistory(clients[request.clientId]);
    }
    renderAdminRoute(routeSelect.value);
  }
  showToast(approved ? 'Solicitud aprobada y aplicada al cliente.' : 'Solicitud rechazada.');
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  pendingList.addEventListener('click', event => {
    const button = event.target.closest('[data-pending-action]');
    if (!button) return;
    const { pendingAction, pendingId } = button.dataset;
    if (pendingAction === 'approve') {
      const request = pendingRequests.find(item => item.id === pendingId);
      if (!request) return;
      if (request.type === 'finance' || request.type === 'retanqueo') {
        openCustomModal({
          title: `Aprobar ${request.type === 'finance' ? 'financiación' : 'retanqueo'} · ${request.clientName}`,
          description: `${request.workerName} lo solicitó con estos valores: ${restructureSummary(request)}.${request.type === 'retanqueo' ? ' El monto extra entra hoy como préstamo en la liquidación y los seguros a la base.' : ''}`,
          submitLabel: 'Aprobar y aplicar',
          onSubmit: () => resolvePendingRequest(pendingId, true),
        });
        return;
      }
      if (request.type === 'route-correction') {
        openCustomModal({
          title: 'Revisar visita o pago',
          description: `${request.workerName} solicita corregir la visita de ${request.clientName} (${formatDate(request.visitDate)}). Comentario: ${request.comment}`,
          fields: [{ name: 'amount', label: `Monto correcto del abono (${formatDate(request.visitDate)})`, money: true, thousands: true, type: 'number', min: 1, step: 1, required: true, value: request.requestedAmount || '', placeholder: 'Ingresa el monto acordado' }],
          submitLabel: 'Guardar monto',
          onSubmit: values => {
            const client = clients[request.clientId];
            const existingPayment = (client?.payments || []).find(payment => payment.date === request.visitDate);
            const available = Number(client?.balance || 0) + Number(existingPayment?.amount || 0);
            if (!Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0) { customModalError.textContent = 'Ingresa un monto mayor que cero.'; return false; }
            if (Number(values.amount) > available) { customModalError.textContent = 'El monto corregido supera el saldo que puede aplicarse al crédito.'; return false; }
            resolvePendingRequest(pendingId, true, Number(values.amount));
          }
        });
        return;
      }
      openCustomModal({
        title: request.type === 'interest' ? 'Aprobar excepción de interés' : 'Aprobar excepción de seguros',
        description: `Acuerdo informado por ${request.workerName} para ${request.clientName}: ${request.comment || 'Sin comentario'}. Ingresa el porcentaje aprobado.`,
        fields: [{ name: 'approvedValue', label: 'Porcentaje aprobado (%)', type: 'number', min: 0, step: 0.1, required: true }],
        submitLabel: 'Aprobar y aplicar',
        onSubmit: values => {
          const percent = Number(values.approvedValue);
          if (!Number.isFinite(percent) || percent > 100) { customModalError.textContent = 'Ingresa un porcentaje entre 0 y 100.'; return false; }
          resolvePendingRequest(pendingId, true, percent);
        }
      });
    }
    else {
      const request = pendingRequests.find(item => item.id === pendingId);
      if (!request) return;
      openCustomModal({ title: 'Rechazar solicitud', description: request.type === 'route-correction' ? `¿Deseas rechazar la corrección solicitada para ${request.clientName}?` : request.type === 'finance' || request.type === 'retanqueo' ? `¿Deseas rechazar la solicitud de ${request.workerName} para ${request.clientName}? La cartulina queda como está.` : `¿Deseas rechazar la solicitud de ${request.clientName}? El cliente conservará los valores generales.`, submitLabel: 'Rechazar solicitud', onSubmit: () => resolvePendingRequest(pendingId, false) });
    }
  });
}
