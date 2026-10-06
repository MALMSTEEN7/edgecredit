/**
 * ui/shortcuts · Atajos globales de teclado (Escape cierra el modal activo).
 */

import { customModal, interestModal, modal, newClientModal } from '../core/dom.js';
import { closeInterestModal } from '../features/clients/interest.js';
import { closeNewClientModal } from '../features/clients/new-client.js';
import { closePayment } from '../features/payments/payment.js';
import { closeCustomModal } from './custom-modal.js';

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!customModal.hidden) closeCustomModal();
    else if (!newClientModal.hidden) closeNewClientModal();
    else if (!interestModal.hidden) closeInterestModal();
    else if (!modal.hidden) closePayment();
  });
}
