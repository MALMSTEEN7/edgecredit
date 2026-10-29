/**
 * features/admin/settlement · Liquidación (cuadre de caja) y cierre de ruta con descuadre.
 */

import { adminFeedback, routeSelect, settlementInputs } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, pendingRequests, persistBusinessData, routeSettlements } from '../../core/store.js';
import { carriedBase, mondayBaseFor, otherExpensesNote, paymentStamp, pendingRoutePayments, recordClosure, setOtherExpensesNote } from '../../domain/ledger.js';
import { insuranceCollectedOn } from '../../domain/insurance.js';
import { cardLabel } from '../../domain/person-cards.js';
import { localDateISO } from '../../shared/dates.js';
import { formatMoney, routeKey } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';
import { renderAdminRoute } from './admin-shell.js';
import { renderRoutePicker } from './route-picker.js';

const CLOSURE_FIELDS = ['collections', 'base', 'loans', 'expenses', 'otherExpenses', 'cashDelivered'];

/** Estado del cierre de hoy: 'closed' (enviado y sin cambios), 'changed' (editado después) o null. */
function closureStatus(route) {
  const closure = route?.lastClosure;
  if (!closure || closure.date !== localDateISO()) return null;
  // Tras el cierre el día se reinicia: se compara contra los valores que quedaron después del reinicio.
  const reference = closure.after || closure.snapshot;
  return CLOSURE_FIELDS.every(field => Number(route[field] || 0) === Number(reference?.[field] || 0)) ? 'closed' : 'changed';
}

/** Solicitudes del trabajador de ese cobro que esperan revisión del admin. */
function pendingRequestCount(routeId) {
  return pendingRequests.filter(request => request?.status === 'pending' && routeKey(request.routeId || request.route) === routeId).length;
}

/**
 * Marca en el selector de cobros: ✓ ya cuadrado y enviado hoy (⚠ si cambió después) y un
 * punto azul neón después del nombre si el cobro tiene solicitudes pendientes por revisar.
 */
export function refreshRouteOptions() {
  [...routeSelect.options].forEach(option => {
    const route = routeSettlements[option.value];
    if (!route) return;
    const status = closureStatus(route);
    const name = route.name || option.value;
    const pending = pendingRequestCount(option.value);
    // El menú visible (route-picker.js) dibuja estos datos con el punto neón.
    option.dataset.name = name;
    option.dataset.status = status || '';
    option.dataset.pending = String(pending);
    option.textContent = `${status === 'closed' ? '✓ ' : status === 'changed' ? '⚠ ' : ''}${name}${pending ? ' (pendientes)' : ''}`;
  });
  renderRoutePicker();
  const route = routeSettlements[routeSelect.value];
  const status = closureStatus(route);
  const badge = document.querySelector('#route-closure-status');
  badge.hidden = !status;
  badge.dataset.status = status || '';
  if (status === 'closed') {
    const time = new Date(route.lastClosure.submittedAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    badge.textContent = `✓ Cuadrado y enviado hoy, ${time}`;
  } else if (status === 'changed') {
    badge.textContent = '⚠ Cambió después del cierre: verifica y envía de nuevo';
  }
}

/**
 * Reinicio del día al cerrar el cobro. Lo único que pasa al día siguiente es el efectivo:
 * se convierte en la base del nuevo día. Cobros, préstamos, gastos, otros gastos, seguros
 * y efectivo entregado vuelven a 0. El sábado el efectivo se entrega, así que la base
 * del lunes arranca en 0, salvo la «Base para el lunes» que el admin asigne ese sábado.
 */
function resetRouteDay(route, routeId, transfers = 0) {
  const computedCash = Number(route.collections || 0) + Number(route.base || 0) - Number(route.loans || 0) - Number(route.expenses || 0) - Number(route.otherExpenses || 0);
  const cash = Number(route.cashDelivered || 0) > 0 ? Number(route.cashDelivered) : Math.max(0, computedCash);
  const saturday = new Date().getDay() === 6;
  // Lo que entró por transferencia está en el banco: no pasa a la base del día siguiente.
  // El sábado solo pasa la base para el lunes que haya asignado el admin.
  const carried = saturday ? mondayBaseFor(route, localDateISO()) : Math.max(0, cash - transfers);
  route.collections = 0;
  route.loans = 0;
  route.expenses = 0;
  route.otherExpenses = 0;
  route.cashDelivered = 0;
  // La base del día siguiente (la misma que ve el trabajador) arranca con ese efectivo.
  route.base = carried;
  route.baseBank = 0;
  return { cash, carried, saturday };
}

/**
 * Al empezar un día nuevo, la base de cada ruta (y la caja de su trabajador) toma el efectivo
 * del último día cerrado. Solo una vez por día y solo si hoy todavía no hay movimientos, para
 * no pisar préstamos, cobros o una base que el admin ya haya asignado. Devuelve true si cambió algo.
 */
export function applyCarriedBases(today = localDateISO()) {
  let changed = false;
  Object.entries(routeSettlements).forEach(([routeId, route]) => {
    if (!route || route.baseCarriedOn === today || route.lastClosure?.date === today) return;
    const started = ['collections', 'loans', 'expenses', 'otherExpenses', 'cashDelivered'].some(field => Number(route[field] || 0) !== 0);
    if (started) return;
    const carried = carriedBase(route, today, date => transfersOn(routeId, date));
    if (!carried) return;
    route.base = carried.amount;
    route.baseBank = 0;
    route.baseCarriedOn = today;
    route.baseCarriedFrom = carried.date;
    changed = true;
  });
  return changed;
}

/** Abonos de la ruta recibidos por transferencia en una fecha. */
function transfersOn(routeId, dateISO) {
  return Object.values(clients).reduce((sum, client) => {
    if (client?.route !== routeId) return sum;
    return sum + (client.payments || []).filter(payment => payment.date === dateISO && payment.method === 'transfer').reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  }, 0);
}

/**
 * Abonos de la ruta pendientes de cierre: los de hoy y los de días anteriores en que no se
 * cerró la ruta (suman en el cobro hasta el cierre). Tras «Verificar y cerrar ruta» salen.
 */
export function renderDayPayments(routeId) {
  const today = localDateISO();
  const rows = pendingRoutePayments(clients, routeId, routeSettlements[routeId]);
  const total = rows.reduce((sum, row) => sum + Number(row.payment.amount), 0);
  const earlier = rows.filter(row => row.payment.date < today).length;
  const body = document.querySelector('#day-payments-body');
  body.replaceChildren(...rows.map(({ clientId, client, payment }) => {
    const row = document.createElement('tr');
    row.classList.toggle('is-earlier-day', payment.date < today);
    const name = document.createElement('th');
    name.scope = 'row';
    const card = cardLabel(clients, clientId);
    name.textContent = card ? `${client.name} · ${card}` : client.name;
    const date = document.createElement('td');
    date.className = 'day-payment-date';
    date.textContent = paymentStamp(payment);
    const method = document.createElement('td');
    method.textContent = payment.method === 'transfer' ? 'Transferencia' : 'Efectivo';
    const amount = document.createElement('td');
    amount.className = 'numeric';
    amount.textContent = formatMoney(payment.amount);
    row.append(name, date, method, amount);
    return row;
  }));
  const foot = document.querySelector('#day-payments-foot');
  foot.replaceChildren();
  if (rows.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<th scope="row" colspan="3">Total abonos</th><td class="numeric"></td>';
    row.lastElementChild.textContent = formatMoney(total);
    foot.append(row);
  }
  document.querySelector('#day-payments-wrap').hidden = !rows.length;
  document.querySelector('#day-payments-empty').hidden = Boolean(rows.length);
  document.querySelector('#day-payments-summary').textContent = rows.length
    ? `${rows.length} abono${rows.length === 1 ? '' : 's'} · ${formatMoney(total)}${earlier ? ` · ${earlier} de días sin cerrar` : ''}`
    : 'Sin abonos hoy';
}

const isSaturday = () => new Date().getDay() === 6;

/** Menú «Base para el lunes»: se ve siempre, pero solo se puede cambiar los sábados. */
export function renderMondayBase(routeId) {
  const route = routeSettlements[routeId];
  const panel = document.querySelector('#monday-base');
  if (!route || !panel) return;
  const editable = isSaturday();
  const input = document.querySelector('#monday-base-amount');
  // Fuera del sábado se muestra la que quedó asignada el último sábado (si ya no se usó).
  const pending = route.mondayBase?.date && (editable ? route.mondayBase.date === localDateISO() : route.mondayBase.date >= lastSaturdayISO());
  const amount = pending ? Number(route.mondayBase.amount) || 0 : 0;
  if (document.activeElement !== input) input.value = pending ? String(amount) : '';
  input.disabled = !editable;
  document.querySelector('#monday-base-save').disabled = !editable;
  document.querySelector('#monday-base-summary').textContent = pending && amount ? formatMoney(amount) : editable ? 'Sin asignar' : 'Solo los sábados';
}

function lastSaturdayISO() {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 1) % 7));
  return localDateISO(date);
}

/** Guarda la base del lunes. Si el sábado ya se cerró, la base que dejó el cierre se ajusta ya. */
function saveMondayBase() {
  const routeId = routeSelect.value;
  const route = routeSettlements[routeId];
  if (!route || !isSaturday()) { showToast('La base para el lunes solo se puede asignar los sábados.'); return; }
  const today = localDateISO();
  const amount = Math.max(0, Math.round(Number(document.querySelector('#monday-base-amount').value) || 0));
  route.mondayBase = { amount, date: today, setAt: new Date().toISOString() };
  const closedToday = route.lastClosure?.date === today && route.ledger?.[today]?.closed;
  if (closedToday) {
    route.base = amount;
    route.baseBank = 0;
    route.lastClosure.carriedBase = amount;
    if (route.lastClosure.after) route.lastClosure.after.base = amount;
  }
  persistBusinessData();
  renderAdminRoute(routeId);
  refreshRouteOptions();
  showToast(amount ? `Base para el lunes de ${route.name}: ${formatMoney(amount)}.` : `${route.name} arranca el lunes en ${formatMoney(0)}.`);
}

/**
 * Junto al título «Base»: los seguros del día que ya están sumados en la base y la base sin
 * ellos. Tras cerrar hoy solo cuentan los seguros cobrados después del cierre.
 */
export function renderBaseBreakdown(routeId) {
  const route = routeSettlements[routeId];
  if (!route) return;
  const today = localDateISO();
  const since = route.lastClosure?.date === today ? Date.parse(route.lastClosure.submittedAt) || 0 : 0;
  const insurance = insuranceCollectedOn(clients, routeId, today, since);
  document.querySelector('#base-insurance-label').textContent = insurance.count ? `Seguros del día (${insurance.count})` : 'Seguros del día';
  document.querySelector('#base-insurance').textContent = `+ ${formatMoney(insurance.total)}`;
  document.querySelector('#base-own').textContent = formatMoney(Number(route.base || 0) - insurance.total);
  document.querySelector('#base-breakdown').title = insurance.total
    ? `La base de ${formatMoney(route.base)} incluye ${formatMoney(insurance.total)} de seguros cobrados hoy`
    : 'Hoy no se han cobrado seguros en esta ruta';
}

/** Comentario de «Otros gastos» del día: es el mismo que sale en Reportes financieros. */
export function renderSettlementOtherNote(routeId) {
  const route = routeSettlements[routeId];
  if (!route) return;
  const note = otherExpensesNote(route, localDateISO());
  const preview = document.querySelector('#settlement-other-note-preview');
  preview.hidden = !note;
  preview.textContent = note.replace(/\n/g, ' · ');
  preview.title = note;
  document.querySelector('#settlement-other-note').textContent = note ? '💬 Editar' : '💬 Comentario';
}

function openSettlementOtherNote() {
  const routeId = routeSelect.value;
  const route = routeSettlements[routeId];
  if (!route) return;
  const today = localDateISO();
  openCustomModal({
    title: `Otros gastos · ${route.name}`,
    description: `Comentario de hoy (${formatMoney(route.otherExpenses || 0)} en otros gastos). Sale en Reportes financieros, en «Otros gastos» de este día.`,
    fields: [{ name: 'note', label: '¿En qué se gastó?', type: 'textarea', rows: 4, value: otherExpensesNote(route, today), placeholder: 'Ej. Pinchada $ 12.000, gasolina $ 20.000' }],
    submitLabel: 'Guardar comentario',
    onSubmit: values => {
      setOtherExpensesNote(route, today, values.note);
      persistBusinessData();
      renderSettlementOtherNote(routeId);
      showToast('Comentario guardado. Ya sale en Reportes financieros.');
    },
  });
}

export function renderRouteOperations(route) {
  if (!route) return;
  document.querySelector('#report-route-name').textContent = route.name.toLocaleUpperCase('es');
}

export function recalculateSettlement() {
  const route = state.activeSettlement;
  if (!route) return;
  state.settlementDifference = route.collections + route.base - route.loans - route.expenses - route.cashDelivered - route.otherExpenses;
  const difference = document.querySelector('#metric-difference');
  const differenceCard = document.querySelector('#difference-card');
  difference.textContent = formatMoney(state.settlementDifference);
  differenceCard.classList.toggle('is-balanced', state.settlementDifference === 0);
  differenceCard.classList.toggle('is-short', state.settlementDifference < 0);
  differenceCard.classList.toggle('is-surplus', state.settlementDifference > 0);
  document.querySelector('#difference-caption').textContent = state.settlementDifference === 0 ? 'Cuadre perfecto' : state.settlementDifference < 0 ? `Faltan ${formatMoney(Math.abs(state.settlementDifference))}` : `Sobran ${formatMoney(state.settlementDifference)}`;
  document.querySelector('#verify-close-route').disabled = false;
  adminFeedback.textContent = state.settlementDifference < 0 ? 'La ruta presenta un faltante; el envío requerirá confirmación para auditoría.' : ''; 
  refreshRouteOptions();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#monday-base-save').addEventListener('click', saveMondayBase);
  document.querySelector('#settlement-other-note').addEventListener('click', openSettlementOtherNote);
  settlementInputs.forEach(input => input.addEventListener('input', () => {
    const field = input.dataset.settlementField;
    const amount = Number(input.value);
    if (!state.activeSettlement) return;
    state.activeSettlement[field] = Number.isFinite(amount) && amount >= 0 ? amount : 0;
    if (field === 'base') renderBaseBreakdown(routeSelect.value);
    recalculateSettlement();
    persistBusinessData();
  }));
  document.querySelector('#verify-close-route').addEventListener('click', () => {
    const submitRouteClosure = () => {
      const payload = {
        route: state.activeSettlement.name,
        collections: state.activeSettlement.collections,
        base: state.activeSettlement.base,
        loans: state.activeSettlement.loans,
        expenses: state.activeSettlement.expenses,
        otherExpenses: state.activeSettlement.otherExpenses,
        cashDelivered: state.activeSettlement.cashDelivered,
        difference: state.settlementDifference,
        submittedAt: new Date().toISOString()
      };
      // Punto de integración para el POST del backend cuando la API esté disponible.
      window.dispatchEvent(new CustomEvent('edgecredit:route-close', { detail: payload }));
      const route = routeSettlements[routeSelect.value] || state.activeSettlement;
      const routeId = routeSelect.value;
      // Transferencias que entran a este cierre: también las de días anteriores sin cerrar.
      const transfers = pendingRoutePayments(clients, routeId, route)
        .filter(({ payment }) => payment.method === 'transfer')
        .reduce((sum, { payment }) => sum + Number(payment.amount), 0);
      route.lastClosure = {
        date: localDateISO(), submittedAt: payload.submittedAt, difference: payload.difference,
        snapshot: Object.fromEntries(CLOSURE_FIELDS.map(field => [field, Number(route[field] || 0)]))
      };
      // Libro diario: el día queda guardado con su fecha antes de reiniciar el resumen.
      const previousClosureTs = route.lastClosure?.date === localDateISO() && route.ledger?.[localDateISO()]?.closed ? Number(route.ledger[localDateISO()].closedTs) : 0;
      const insurance = insuranceCollectedOn(clients, routeId, localDateISO(), previousClosureTs).total;
      recordClosure(route, localDateISO(), { ...route, insurance, transfers }, Date.parse(payload.submittedAt));
      const reset = resetRouteDay(route, routeId, transfers);
      route.lastClosure.carriedBase = reset.carried;
      route.lastClosure.after = Object.fromEntries(CLOSURE_FIELDS.map(field => [field, Number(route[field] || 0)]));
      persistBusinessData();
      renderAdminRoute(routeId);
      refreshRouteOptions();
      const nextBase = reset.saturday
        ? `Sábado: el efectivo (${formatMoney(reset.cash)}) se entrega y la base del lunes arranca en ${formatMoney(reset.carried)}.`
        : transfers
          ? `El efectivo del día (${formatMoney(reset.cash)}) menos ${formatMoney(transfers)} de transferencias pasa como base del día siguiente: ${formatMoney(reset.carried)}. El resto del resumen quedó en 0.`
          : `El efectivo del día (${formatMoney(reset.cash)}) pasa como base del día siguiente; el resto del resumen quedó en 0.`;
      adminFeedback.textContent = `Cierre de ${state.activeSettlement.name} enviado para auditoría. Diferencia: ${formatMoney(payload.difference)}. ${nextBase}`;
      showToast(payload.difference === 0 ? `Ruta cerrada. ${nextBase}` : `Cierre enviado con diferencia para auditoría. ${nextBase}`);
    };
    if (state.settlementDifference !== 0) {
      const amount = formatMoney(Math.abs(state.settlementDifference));
      const direction = state.settlementDifference < 0 ? 'faltante' : 'sobrante';
      openCustomModal({
        title: 'Enviar cierre con diferencia',
        description: `Existe un descuadre de ${amount} (${direction}). ¿Desea enviar el cierre con esta diferencia para auditoría posterior?`,
        submitLabel: 'Enviar a auditoría',
        onSubmit: submitRouteClosure
      });
      return;
    }
    submitRouteClosure();
  });
}
