/**
 * features/admin/evidence · Comprobantes por día: transferencias y otros gastos.
 * Muestra también los registros SIN comprobante, marcados con un indicador, para que
 * el admin pueda auditarlos (antes las transferencias sin foto pasaban desapercibidas).
 */

import { routeSelect } from '../../core/dom.js';
import { clients, persistBusinessData, routeSettlements, workerForRoute } from '../../core/store.js';
import { otherExpensesNote, setOtherExpensesNote } from '../../domain/ledger.js';
import { localDateISO } from '../../shared/dates.js';
import { formatDate, formatMoney } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { bindImageViewer } from '../../ui/image-viewer.js';
import { showToast } from '../../ui/toast.js';

let selectedDate = '';
const qs = selector => document.querySelector(selector);

function evidenceDate() {
  return selectedDate || localDateISO();
}

/** Tarjeta común: monto, descripción y miniatura del comprobante o indicador de faltante. */
function evidenceItem({ amount, title, detail, receiptData, receiptLabel }) {
  const item = document.createElement('article');
  item.className = 'expense-evidence-item';
  item.classList.toggle('is-missing-evidence', !receiptData);
  const details = document.createElement('div');
  const value = document.createElement('strong');
  value.textContent = formatMoney(amount);
  const name = document.createElement('span');
  name.className = 'evidence-title';
  name.textContent = title;
  const meta = document.createElement('span');
  meta.textContent = detail;
  details.append(value, name, meta);
  if (receiptData) {
    const receipt = bindImageViewer(document.createElement('button'), { src: receiptData, title: `${formatMoney(amount)} · ${title}`, caption: detail });
    receipt.type = 'button';
    receipt.className = 'expense-receipt-link';
    receipt.setAttribute('aria-label', `Ver ${receiptLabel}`);
    const image = document.createElement('img');
    image.className = 'evidence-thumbnail';
    image.src = receiptData;
    image.alt = receiptLabel;
    const label = document.createElement('span');
    label.textContent = 'Ampliar';
    receipt.append(image, label);
    item.append(details, receipt);
  } else {
    const missing = document.createElement('span');
    missing.className = 'evidence-missing-badge';
    missing.setAttribute('role', 'status');
    missing.innerHTML = '<span aria-hidden="true">!</span>Sin comprobante';
    item.append(details, missing);
  }
  return item;
}

function renderList(list, summary, items, emptyText) {
  list.replaceChildren();
  const missing = items.filter(item => !item.receiptData).length;
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  summary.replaceChildren();
  if (items.length) {
    const amount = document.createElement('strong');
    amount.className = 'evidence-total';
    amount.textContent = `Total ${formatMoney(total)}`;
    summary.append(amount, ` · ${items.length} ${items.length === 1 ? 'registro' : 'registros'}${missing ? ` · ${missing} sin comprobante` : ' · todos con comprobante'}`);
  }
  summary.classList.toggle('has-missing', missing > 0);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'expense-evidence-empty';
    empty.textContent = emptyText;
    list.append(empty);
    return;
  }
  // Primero los que no tienen comprobante: son los que requieren atención.
  items.sort((a, b) => Number(Boolean(a.receiptData)) - Number(Boolean(b.receiptData)) || String(b.sortKey).localeCompare(String(a.sortKey)));
  items.forEach(item => list.append(evidenceItem(item)));
}

function renderTransferEvidence(routeId, date) {
  const worker = workerForRoute(routeId);
  const items = Object.values(clients).flatMap(client => client.route === routeId
    ? (client.payments || []).filter(payment => payment.method === 'transfer' && payment.date === date).map(payment => ({
      amount: payment.amount,
      title: client.name,
      detail: `${formatDate(payment.date)}${worker ? ` · Cobró ${worker.name}` : ''}`,
      receiptData: payment.receiptData || '',
      receiptLabel: `comprobante de transferencia de ${client.name}`,
      sortKey: payment.createdAt || payment.date
    }))
    : []);
  renderList(qs('#admin-transfer-evidence-list'), qs('#transfer-evidence-summary'), items, 'No hay transferencias registradas en esta fecha.');
}

function renderOtherExpenseEvidence(route, date) {
  const items = (route.otherExpenseEntries || []).filter(entry => (entry.date || String(entry.createdAt).slice(0, 10)) === date).map(entry => ({
    amount: entry.amount,
    title: entry.note || 'Gasto sin descripción',
    detail: `${entry.workerName || 'Trabajador'} · ${formatDate(entry.date)}`,
    receiptData: entry.receiptData || '',
    receiptLabel: `comprobante de ${formatMoney(entry.amount)}: ${entry.note}`,
    sortKey: entry.createdAt
  }));
  renderList(qs('#admin-other-expense-list'), qs('#expense-evidence-summary'), items, 'No hay otros gastos registrados en esta fecha.');
  renderOtherExpenseComment(route, date);
}

/** Comentario de otros gastos del día: es el mismo que sale en Reportes financieros. */
function renderOtherExpenseComment(route, date) {
  const note = otherExpensesNote(route, date);
  const text = qs('#other-expense-comment-text');
  text.textContent = note ? `Comentario: ${note}` : 'Sin comentario para los reportes financieros.';
  text.classList.toggle('is-empty', !note);
  qs('#other-expense-comment-button').textContent = note ? '💬 Editar comentario' : '💬 Agregar comentario';
}

function openOtherExpenseComment() {
  const route = routeSettlements[routeSelect.value];
  if (!route) return;
  const date = evidenceDate();
  const day = new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: '2-digit' });
  openCustomModal({
    title: `Comentario de otros gastos · ${day}`,
    description: `Ruta ${route.name}. Este comentario aparece en Reportes financieros, en «Otros gastos» de ese día.`,
    fields: [{ name: 'note', label: 'Comentario', type: 'textarea', rows: 4, value: otherExpensesNote(route, date), placeholder: 'Ej. Pinchada $ 12.000, gasolina $ 20.000' }],
    submitLabel: 'Guardar comentario',
    onSubmit: values => {
      setOtherExpensesNote(route, date, values.note);
      persistBusinessData();
      renderOtherExpenseComment(route, date);
      showToast('Comentario guardado. Ya sale en Reportes financieros.');
    },
  });
}

export function renderRouteEvidence(routeId) {
  const route = routeSettlements[routeId];
  if (!route) return;
  const date = evidenceDate();
  qs('#receipts-route-name').textContent = route.name.toLocaleUpperCase('es');
  qs('#receipts-date-input').value = date;
  qs('#receipts-today').disabled = date === localDateISO();
  renderTransferEvidence(routeId, date);
  renderOtherExpenseEvidence(route, date);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  qs('#receipts-date-input').addEventListener('change', event => {
    selectedDate = event.target.value || '';
    renderRouteEvidence(routeSelect.value);
  });
  qs('#other-expense-comment-button').addEventListener('click', openOtherExpenseComment);
  qs('#receipts-today').addEventListener('click', () => {
    selectedDate = '';
    renderRouteEvidence(routeSelect.value);
  });
}
