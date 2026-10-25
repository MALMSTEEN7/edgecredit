/**
 * features/worker/expenses · Menú (modal) de registro de "otros gastos", abierto desde
 * la tarjeta "Otros gastos" del Resumen del día, con foto de comprobante (opcional:
 * si falta, el gasto queda marcado "Sin comprobante" en la auditoría del admin).
 */

import { routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { persistBusinessData, routeSettlements } from '../../core/store.js';
import { renderAdminRoute } from '../admin/admin-shell.js';
import { updateCashTotal } from './cash-box.js';
import { localDateISO } from '../../shared/dates.js';
import { formatMoney } from '../../shared/format.js';
import { compressClientPhoto } from '../../shared/media.js';
import { showToast } from '../../ui/toast.js';

const expenseModal = () => document.querySelector('#worker-expense-modal');

function resetExpenseForm() {
  const form = document.querySelector('#worker-expense-form');
  form.reset();
  document.querySelector('#worker-expense-preview').hidden = true;
  document.querySelector('#worker-expense-preview').removeAttribute('src');
  document.querySelector('#worker-expense-file-name').textContent = 'Ningún archivo seleccionado';
  document.querySelector('#worker-expense-error').textContent = '';
}

/** Abre el menú de "otro gasto" (monto, descripción y foto de evidencia). */
export function openExpenseModal() {
  if (state.userRole !== 'worker') return;
  resetExpenseForm();
  const modal = expenseModal();
  modal.hidden = false;
  modal.classList.add('active');
  document.body.classList.add('modal-open');
  window.setTimeout(() => document.querySelector('#worker-expense-amount').focus(), 30);
}

function closeExpenseModal() {
  const modal = expenseModal();
  if (modal.hidden) return;
  modal.hidden = true;
  modal.classList.remove('active');
  resetExpenseForm();
  if (!document.querySelector('.custom-modal-backdrop:not([hidden]), .modal-backdrop:not([hidden]), .ops-list-modal-backdrop:not([hidden])')) document.body.classList.remove('modal-open');
  document.querySelector('#open-worker-expense')?.focus();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#worker-expense-receipt').addEventListener('change', event => {
    const preview = document.querySelector('#worker-expense-preview');
    const file = event.target.files?.[0];
    document.querySelector('#worker-expense-file-name').textContent = file?.name || 'Ningún archivo seleccionado';
    if (!file) { preview.hidden = true; preview.removeAttribute('src'); return; }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
  document.querySelector('#worker-expense-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = document.querySelector('#worker-expense-error');
    error.textContent = '';
    if (state.userRole !== 'worker' || !form.reportValidity()) return;
    const amount = Math.round(Number(form.elements.amount.value));
    const file = form.elements.receipt.files?.[0];
    const route = routeSettlements[state.workerRoute];
    if (!route || !Number.isFinite(amount) || amount <= 0) {
      error.textContent = 'Ingresa un monto válido.';
      return;
    }
    try {
      const receiptData = file ? await compressClientPhoto(file, { maxDimension: 1200, quality: 0.78 }) : '';
      route.otherExpenses = Math.max(0, Number(route.otherExpenses) || 0) + amount;
      route.otherExpenseEntries ||= [];
      route.otherExpenseEntries.unshift({ id: `expense-${Date.now()}`, amount, note: form.elements.note.value.trim(), date: localDateISO(), createdAt: new Date().toISOString(), workerId: state.activeWorker.id, workerName: state.activeWorker.name, receiptName: file?.name || '', receiptData });
      persistBusinessData();
      updateCashTotal();
      if (routeSelect.value === state.workerRoute) renderAdminRoute(state.workerRoute);
      closeExpenseModal();
      showToast(file ? `Gasto de ${formatMoney(amount)} registrado con comprobante.` : `Gasto de ${formatMoney(amount)} registrado SIN comprobante: quedará marcado para el administrador.`);
    } catch (uploadError) {
      error.textContent = uploadError.message || 'No se pudo procesar la foto del comprobante.';
    }
  });
  document.querySelector('#open-worker-expense').addEventListener('click', openExpenseModal);
  document.querySelector('#cancel-worker-expense').addEventListener('click', closeExpenseModal);
  document.querySelector('#close-worker-expense').addEventListener('click', closeExpenseModal);
  expenseModal().addEventListener('click', event => { if (event.target === expenseModal()) closeExpenseModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeExpenseModal(); });
}
