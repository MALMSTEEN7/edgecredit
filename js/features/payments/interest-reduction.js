/**
 * features/payments/interest-reduction · «Reducir intereses» del abono final de una cartulina
 * cancelada antes de la mitad del plazo (el cliente pagó antes y se le descontaron intereses).
 *
 * - Admin: se aplica de una vez (domain/restructure · applyInterestReduction).
 * - Trabajador: se envía como solicitud al admin. Mientras espera, el abono queda marcado
 *   («Reducción solicitada») en su resumen del día. Si el admin la aprueba se aplica; si la
 *   rechaza, ese abono final se elimina (admin/pending.js).
 */

import { customModalError } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, pendingRequests, persistBusinessData, routeSettlements } from '../../core/store.js';
import { syncCancelledCard } from '../../domain/accounting.js';
import { finalPayment } from '../../domain/route-day.js';
import { adjustClosedTransfers, syncRouteCollections } from '../../domain/ledger.js';
import { applyInterestReduction, maxInterestReduction, reductionAllowed } from '../../domain/restructure.js';
import { formatDate, formatMoney, routeKey } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';
import { renderPendingRequests } from '../admin/pending.js';

/** ¿Se puede ofrecer «Reducir intereses» para este abono final? */
export function canOfferReduction(client, payment) {
  return Boolean(client && payment) && Number(client.balance) <= 0 && !payment.reductionRequest && !payment.reductionWaived
    && !(Number(payment.interestReduction) > 0) && reductionAllowed(client, payment);
}

/**
 * El administrador puede reducir intereses de cualquier cartulina cancelada, sin importar
 * cuándo se pagó (el límite de la mitad del plazo es para ofrecerla al trabajador y antes de
 * renovar). Mientras quede interés por descontar en el abono final.
 */
export function canAdminReduce(client, payment) {
  return Boolean(client && payment) && Number(client.balance) <= 0 && Number(payment.amount) > 0 && maxInterestReduction(client, payment) > 0;
}

/**
 * Antes de renovar una cartulina cancelada antes de la mitad del plazo hay que resolver la
 * reducción de intereses: aplicarla (admin), solicitarla (trabajador) o indicar que no hubo
 * descuento. Mientras no se resuelva, no se puede renovar. `proceed()` sigue con la renovación.
 */
export function requireReductionBeforeRenewal(clientId, proceed) {
  const client = clients[clientId];
  const payment = client && finalPayment(client);
  if (!canOfferReduction(client, payment)) { proceed(); return; }
  const isAdmin = state.userRole === 'admin';
  openCustomModal({
    title: 'Primero, la reducción de intereses',
    description: `${client.name} canceló antes de la mitad del plazo. Antes de renovar, ${isAdmin ? 'aplica' : 'solicita'} la reducción de intereses. Si no se le hizo ningún descuento, indícalo con «No hubo descuento».`,
    submitLabel: isAdmin ? 'Reducir intereses' : 'Solicitar reducción',
    cancelLabel: 'Ahora no',
    extraAction: {
      label: 'No hubo descuento',
      onClick: () => {
        payment.reductionWaived = { at: new Date().toISOString(), by: isAdmin ? 'Administrador' : (state.activeWorker?.name || 'Trabajador') };
        persistBusinessData();
        proceed();
      },
    },
    onSubmit: () => {
      // Se abre después de que esta ventana se cierre.
      window.setTimeout(() => openInterestReduction(clientId, payment, { onDone: proceed }), 0);
    },
  });
}

/**
 * Abre el cuadro para escribir la reducción. `onDone()` se llama al aplicarla (admin) o al
 * enviar la solicitud (trabajador); `onCancel()` si se cierra con «Cancelar».
 */
export function openInterestReduction(clientId, payment, { onDone = () => {}, onCancel = () => {} } = {}) {
  const client = clients[clientId];
  if (!client || !payment) return;
  const isAdmin = state.userRole === 'admin';
  const max = maxInterestReduction(client, payment);
  openCustomModal({
    title: 'Reducir intereses',
    description: `${client.name} canceló la cartulina con el abono del ${formatDate(payment.date)} por ${formatMoney(payment.amount)}. Escribe cuánto se le descontó de intereses: ese valor se resta del abono final y no entra a la caja. Máximo ${formatMoney(max)}.${Number(payment.interestReduction) > 0 ? ` Ya se le redujeron ${formatMoney(payment.interestReduction)}.` : ''}${isAdmin ? '' : ' La solicitud le llega al administrador para aprobarla.'}`,
    fields: [{ name: 'amount', label: 'Valor de la reducción', money: true, thousands: true, type: 'number', min: 1, step: 1, required: true }],
    submitLabel: isAdmin ? 'Aplicar reducción' : 'Solicitar reducción',
    onSubmit: values => {
      const amount = Math.round(Number(values.amount) || 0);
      if (!(amount > 0)) { customModalError.textContent = 'Escribe el valor de la reducción.'; return false; }
      if (amount > max) { customModalError.textContent = `La reducción no puede pasar de ${formatMoney(max)}.`; return false; }
      if (isAdmin) {
        const before = { ...payment };
        const error = applyInterestReduction(client, payment, amount, { by: 'Administrador' });
        if (error) { customModalError.textContent = error; return false; }
        const route = routeSettlements[client.route];
        // Si el abono final es de un día ya cerrado, ese cierre se corrige (como al editar un abono).
        const closed = adjustClosedTransfers(route, before, { ...payment });
        if (route) syncRouteCollections(clients, { [client.route]: route });
        syncCancelledCard(client, clientId);
        persistBusinessData();
        const closedCopy = closed.length ? ` Cierre del ${formatDate(closed[0].date)} corregido: cobro −${formatMoney(amount)}.` : '';
        showToast(`Reducción de intereses de ${formatMoney(amount)} aplicada a ${client.name}: el abono final quedó en ${formatMoney(payment.amount)}.${closedCopy}`);
      } else {
        const id = `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        pendingRequests.unshift({
          id, type: 'interest-reduction', routeId: routeKey(client.route), route: client.route,
          workerId: state.activeWorker?.id, workerName: state.activeWorker?.name || 'Trabajador', clientId, clientName: client.name,
          amount, paymentAt: payment.at || '', paymentDate: payment.date, paymentAmount: Number(payment.amount) || 0,
          createdAt: new Date().toISOString(), status: 'pending',
        });
        payment.reductionRequest = { id, amount };
        persistBusinessData();
        renderPendingRequests();
        showToast(`Solicitud de reducción de ${formatMoney(amount)} enviada al administrador.`);
      }
      window.setTimeout(onDone, 0);
      return undefined;
    },
    onCancel: () => { window.setTimeout(onCancel, 0); },
  });
}
