/**
 * features/admin/settlement · Liquidación (cuadre de caja) y cierre de ruta con descuadre.
 */

import { adminFeedback, routeSelect, settlementInputs } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData, routeSettlements, shared, workerForRoute } from '../../core/store.js';
import { recordClosure } from '../../domain/ledger.js';
import { insuranceCollectedOn } from '../../domain/insurance.js';
import { localDateISO } from '../../shared/dates.js';
import { formatMoney } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';
import { renderAdminRoute } from './admin-shell.js';

const CLOSURE_FIELDS = ['collections', 'base', 'loans', 'expenses', 'otherExpenses', 'cashDelivered'];

/** Estado del cierre de hoy: 'closed' (enviado y sin cambios), 'changed' (editado después) o null. */
function closureStatus(route) {
  const closure = route?.lastClosure;
  if (!closure || closure.date !== localDateISO()) return null;
  // Tras el cierre el día se reinicia: se compara contra los valores que quedaron después del reinicio.
  const reference = closure.after || closure.snapshot;
  return CLOSURE_FIELDS.every(field => Number(route[field] || 0) === Number(reference?.[field] || 0)) ? 'closed' : 'changed';
}

/** Marca con ✓ en el selector los cobros ya cuadrados y enviados hoy (⚠ si cambiaron después). */
export function refreshRouteOptions() {
  [...routeSelect.options].forEach(option => {
    const route = routeSettlements[option.value];
    if (!route) return;
    const status = closureStatus(route);
    option.textContent = status === 'closed' ? `✓ ${route.name}` : status === 'changed' ? `⚠ ${route.name}` : route.name;
  });
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
 * del lunes arranca en 0 (el admin puede asignarla en Liquidación).
 */
function resetRouteDay(route, routeId) {
  const computedCash = Number(route.collections || 0) + Number(route.base || 0) - Number(route.loans || 0) - Number(route.expenses || 0) - Number(route.otherExpenses || 0);
  const cash = Number(route.cashDelivered || 0) > 0 ? Number(route.cashDelivered) : Math.max(0, computedCash);
  const saturday = new Date().getDay() === 6;
  const carried = saturday ? 0 : cash;
  route.collections = 0;
  route.loans = 0;
  route.expenses = 0;
  route.otherExpenses = 0;
  route.cashDelivered = 0;
  route.base = carried;
  // La caja del trabajador de esa ruta arranca el día siguiente con ese efectivo como base.
  const worker = workerForRoute(routeId);
  if (worker) {
    shared.workBases[worker.id] = { amount: carried, cash: carried, bank: 0, account: 'cash', updatedAt: new Date().toISOString() };
    if (state.activeWorker?.id === worker.id) { state.workBaseCash = carried; state.workBaseBank = 0; state.workBaseAmount = carried; }
  }
  return { cash, carried, saturday };
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
  settlementInputs.forEach(input => input.addEventListener('input', () => {
    const field = input.dataset.settlementField;
    const amount = Number(input.value);
    if (!state.activeSettlement) return;
    state.activeSettlement[field] = Number.isFinite(amount) && amount >= 0 ? amount : 0;
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
      route.lastClosure = {
        date: localDateISO(), submittedAt: payload.submittedAt, difference: payload.difference,
        snapshot: Object.fromEntries(CLOSURE_FIELDS.map(field => [field, Number(route[field] || 0)]))
      };
      // Libro diario: el día queda guardado con su fecha antes de reiniciar el resumen.
      const previousClosureTs = route.lastClosure?.date === localDateISO() && route.ledger?.[localDateISO()]?.closed ? Number(route.ledger[localDateISO()].closedTs) : 0;
      const insurance = insuranceCollectedOn(clients, routeId, localDateISO(), previousClosureTs).total;
      recordClosure(route, localDateISO(), { ...route, insurance }, Date.parse(payload.submittedAt));
      const reset = resetRouteDay(route, routeId);
      route.lastClosure.carriedBase = reset.carried;
      route.lastClosure.after = Object.fromEntries(CLOSURE_FIELDS.map(field => [field, Number(route[field] || 0)]));
      persistBusinessData();
      renderAdminRoute(routeId);
      refreshRouteOptions();
      const nextBase = reset.saturday
        ? `Sábado: el efectivo (${formatMoney(reset.cash)}) se entrega y la base del lunes arranca en ${formatMoney(0)}.`
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
