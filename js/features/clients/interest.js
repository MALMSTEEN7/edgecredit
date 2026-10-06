/**
 * features/clients/interest · Interés moratorio (tarifa general o monto específico).
 */

import { customModal, interestModal, interestToggle, modal, newClientModal, specificInterestForm, specificInterestInput } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData } from '../../core/store.js';
import { refreshClientBalance, renderHistory } from './client-detail.js';

export function closeInterestModal() {
  interestModal.hidden = true;
  specificInterestForm.hidden = true;
  specificInterestForm.reset();
  if (customModal.hidden && newClientModal.hidden && modal.hidden) document.body.classList.remove('modal-open');
}

function applyInterest(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const client = clients[state.activeClient];
  client.balance += amount;
  client.interestHistory.unshift({ date: new Date().toISOString().slice(0, 10), amount });
  persistBusinessData();
  refreshClientBalance();
  renderHistory(client);
  closeInterestModal();
}

function openInterestModal() {
  interestModal.hidden = false;
  document.body.classList.add('modal-open');
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  interestToggle.addEventListener('click', openInterestModal);
  document.querySelector('#apply-general-interest').addEventListener('click', () => applyInterest(clients[state.activeClient].generalInterest));
  document.querySelector('#choose-specific-interest').addEventListener('click', () => {
    specificInterestForm.hidden = false;
    specificInterestInput.focus();
  });
  specificInterestForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!specificInterestForm.reportValidity()) return;
    applyInterest(Number(specificInterestInput.value));
  });
  document.querySelectorAll('[data-close-interest]').forEach(button => button.addEventListener('click', closeInterestModal));
  interestModal.addEventListener('click', event => { if (event.target === interestModal) closeInterestModal(); });
}
