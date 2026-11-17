/**
 * features/admin/audit-console · Consola de movimientos (solo el administrador).
 *
 * Muestra el historial que anota el servidor (supabase/consola.sql): quién cambió qué, cuándo
 * y en qué cobro. Marca lo que conviene revisar:
 *   - «Se quitó»: un abono, préstamo, gasto… desapareció en ese cambio (posible pisada de un
 *     equipo con datos viejos, o un borrado a propósito).
 *   - «Choque resuelto»: dos equipos cambiaron lo mismo a la vez y la app los combinó.
 * Desde aquí se puede deshacer un cambio (domain/audit-undo), recuperar un cliente borrado o
 * abrir el cliente para corregirlo a mano. Los arreglos se guardan como cualquier cambio del
 * administrador y también quedan en el historial.
 */

import { routeSelect } from '../../core/dom.js';
import { backend, backendEnabled, backendErrorMessage } from '../../core/backend.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData, personnel, routeSettlements } from '../../core/store.js';
import { lostItems, rebuildDeleted, undoAuditChanges } from '../../domain/audit-undo.js';
import { formatMoney } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';
import { enterAdminDirectory, renderAdminRoute } from './admin-shell.js';
import { openClient } from '../clients/client-detail.js';
import { renderClientRows, renderClientsBulk } from '../clients/directory.js';

const AUDIT_PAGE = 200;

const FIELD_LABELS = {
  balance: 'Saldo', payments: 'Abonos', totalPaidAmount: 'Total abonado', paid: 'Pagado', principal: 'Préstamo', total: 'Total a pagar',
  installment: 'Cuota', installments: 'Cuotas', totalDays: 'Días', frequency: 'Frecuencia', status: 'Estado', late: 'Atrasado',
  name: 'Nombre', phone: 'Teléfono', address: 'Dirección', addressNotes: 'Indicaciones', interestPercent: 'Interés %', creditStartDate: 'Inicio del crédito',
  notes: 'Notas', note: 'Nota', route: 'Cobro', location: 'Ubicación', settledAt: 'Pagada el', loanHistory: 'Historial de préstamos', visitHistory: 'Visitas',
  base: 'Base', baseBank: 'Base en banco', loans: 'Préstamos', loansNew: 'Préstamos del día', loansEntered: 'Préstamos ingresados', collections: 'Cobro',
  expenses: 'Gastos', otherExpenses: 'Otros gastos', otherExpenseEntries: 'Otros gastos (detalle)', cashDelivered: 'Efectivo entregado',
  cardsCancelled: 'Cartulinas canceladas', monthlyInsurance: 'Seguros del mes', extraInsurance: 'Seguros adicionales', ledger: 'Libro de caja',
  cashBox: 'Caja', insuranceCuts: 'Cortes de seguros', weeklyCollections: 'Cobro semanal', weeklyCardCount: 'Cartulinas de la semana',
  access_enabled: 'Acceso', route_id: 'Cobro asignado', role: 'Rol', username: 'Usuario', data: 'Datos',
};
const TABLE_LABELS = { clients: 'Cliente', routes: 'Cobro', pending_requests: 'Solicitud', profiles: 'Trabajador', app_settings: 'Ajuste', route_state: 'Recorrido' };
const ACTION_LABELS = { insert: 'Creó', update: 'Cambió', delete: 'Borró', merge: 'Choque resuelto' };
const MONEY_FIELDS = new Set(['balance', 'totalPaidAmount', 'paid', 'principal', 'total', 'installment', 'base', 'baseBank', 'loans', 'collections', 'expenses',
  'otherExpenses', 'cashDelivered', 'monthlyInsurance', 'weeklyCollections', 'amount', 'value', 'insurance', 'cash']);

let auditRows = [];
let auditDone = false;
let auditLoading = false;

const fieldLabel = path => path.map(key => FIELD_LABELS[key] || key).join(' › ');

function shortValue(value, key) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return MONEY_FIELDS.has(key) ? formatMoney(value) : String(value);
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'string') return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  if (Array.isArray(value)) return `lista de ${value.length}`;
  return itemSummary(value);
}

/** Un abono, préstamo, gasto… en pocas palabras. */
function itemSummary(item) {
  if (!item || typeof item !== 'object') return shortValue(item);
  const amount = [item.amount, item.value, item.principal, item.cash].find(value => typeof value === 'number');
  const parts = [];
  if (item.name || item.clientName) parts.push(item.name || item.clientName);
  if (typeof amount === 'number') parts.push(formatMoney(amount));
  const when = item.date || item.at || (item.ts ? new Date(item.ts).toISOString() : '');
  if (when) parts.push(formatWhen(when));
  if (item.note) parts.push(`«${String(item.note).slice(0, 40)}»`);
  return parts.join(' · ') || `${Object.keys(item).length} datos`;
}

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return date.toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
  return date.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function actorName(row) {
  if (row.actor_name) return row.actor_name;
  const worker = personnel.find(item => item.id === row.actor);
  return worker?.name || worker?.username || (row.actor ? 'Usuario' : 'Servidor');
}

function recordName(row) {
  if (row.table_name === 'clients') {
    const fromChanges = (row.changes || []).find(change => change.p?.[0] === 'name');
    return clients[row.row_key]?.name || fromChanges?.new || fromChanges?.old || row.row_key;
  }
  if (row.table_name === 'routes') return routeSettlements[row.row_key]?.name || row.row_key;
  if (row.table_name === 'profiles') return personnel.find(item => item.id === row.row_key)?.name || row.row_key;
  return row.row_key;
}

const rowLost = row => (row.changes || []).flatMap(change => lostItems(change).map(item => ({ change, item })));
const isAlert = row => row.action === 'merge' || row.action === 'delete' || rowLost(row).length > 0;

// ── Datos ──

function auditFilters() {
  const panel = document.querySelector('[data-admin-panel="audit"]');
  return {
    route: panel.querySelector('#audit-route').value,
    actor: panel.querySelector('#audit-actor').value,
    since: panel.querySelector('#audit-since').value,
    search: panel.querySelector('#audit-search').value.trim().toLocaleLowerCase('es'),
    alertsOnly: panel.querySelector('#audit-alerts').checked,
  };
}

function matchingClientIds(search) {
  if (!search) return null;
  return Object.entries(clients).filter(([id, client]) => id.toLocaleLowerCase('es').includes(search)
    || String(client?.name || '').toLocaleLowerCase('es').includes(search) || String(client?.id || '').includes(search)).map(([id]) => id).slice(0, 80);
}

async function fetchAuditPage(before) {
  const filters = auditFilters();
  const db = await backend();
  let query = db.from('audit_log').select('*');
  if (filters.route) query = query.eq('route_id', filters.route);
  if (filters.actor) query = query.eq('actor', filters.actor);
  if (filters.since) query = query.gte('at', new Date(`${filters.since}T00:00:00`).toISOString());
  const ids = matchingClientIds(filters.search);
  if (ids) {
    if (!ids.length) return [];
    query = query.eq('table_name', 'clients').in('row_key', ids);
  }
  if (before) query = query.lt('id', before);
  const { data, error } = await query.order('id', { ascending: false }).limit(AUDIT_PAGE);
  if (error) throw error;
  return data || [];
}

async function loadAudit({ more = false } = {}) {
  if (auditLoading) return;
  auditLoading = true;
  const status = document.querySelector('#audit-status');
  status.textContent = 'Cargando movimientos…';
  try {
    if (!more) { auditRows = []; auditDone = false; }
    const before = auditRows.length ? auditRows[auditRows.length - 1].id : null;
    const page = await fetchAuditPage(before);
    auditRows.push(...page);
    auditDone = page.length < AUDIT_PAGE;
    renderAudit();
  } catch (error) {
    status.textContent = /audit_log|relation|does not exist|schema cache/i.test(String(error?.message))
      ? 'Falta activar el historial en el servidor (supabase/consola.sql).'
      : `No se pudieron cargar los movimientos: ${backendErrorMessage(error)}`;
  } finally { auditLoading = false; }
}

// ── Pantalla ──

function changeLine(change) {
  const line = document.createElement('li');
  const name = fieldLabel(change.p || []);
  const key = (change.p || [])[(change.p || []).length - 1];
  if ('added' in change || 'removed' in change) {
    const lost = new Set(lostItems(change));
    (change.added || []).forEach(item => {
      const entry = document.createElement('div');
      entry.className = 'audit-added';
      entry.textContent = `+ ${name}: ${itemSummary(item)}`;
      line.append(entry);
    });
    (change.removed || []).forEach(item => {
      const entry = document.createElement('div');
      entry.className = lost.has(item) ? 'audit-removed is-lost' : 'audit-removed';
      entry.textContent = `${lost.has(item) ? '⚠ Se quitó' : '− Reemplazado'} · ${name}: ${itemSummary(item)}`;
      line.append(entry);
    });
    return line;
  }
  if ('base' in change || 'mine' in change || 'theirs' in change) {
    line.textContent = `${name}: antes ${shortValue(change.base, key)} · este equipo ${shortValue(change.mine, key)} · el otro ${shortValue(change.theirs, key)}`;
    return line;
  }
  line.textContent = `${name}: ${shortValue(change.old, key)} → ${shortValue(change.new, key)}`;
  return line;
}

function auditEntry(row) {
  const item = document.createElement('article');
  item.className = 'audit-entry';
  item.dataset.auditId = row.id;
  const lost = rowLost(row);
  item.classList.toggle('is-alert', isAlert(row));
  const head = document.createElement('header');
  const title = document.createElement('div');
  title.className = 'audit-title';
  const strong = document.createElement('strong');
  strong.textContent = `${ACTION_LABELS[row.action] || row.action} · ${TABLE_LABELS[row.table_name] || row.table_name} ${recordName(row)}`;
  const meta = document.createElement('span');
  const routeName = row.route_id ? (routeSettlements[row.route_id]?.name || row.route_id) : '';
  meta.textContent = `${formatWhen(row.at)} · ${actorName(row)}${routeName ? ` · ${routeName}` : ''}`;
  title.append(strong, meta);
  head.append(title);
  if (lost.length || row.action === 'merge' || row.action === 'delete') {
    const tag = document.createElement('span');
    tag.className = 'audit-tag';
    tag.textContent = row.action === 'merge' ? 'Choque entre equipos' : row.action === 'delete' ? 'Borrado' : `Se quitó ${lost.length}`;
    head.append(tag);
  }
  item.append(head);
  const list = document.createElement('ul');
  list.className = 'audit-changes';
  const changes = row.changes || [];
  const shown = row.action === 'insert' || row.action === 'delete' ? changes.filter(change => ['name', 'balance', 'principal', 'route', 'base', 'amount', 'access_enabled'].includes(change.p?.[0])) : changes;
  shown.slice(0, 30).forEach(change => list.append(changeLine(change)));
  if (changes.length > shown.length) {
    const more = document.createElement('li');
    more.className = 'audit-more';
    more.textContent = `${changes.length - shown.length} dato(s) más`;
    list.append(more);
  }
  item.append(list);
  const actions = document.createElement('div');
  actions.className = 'audit-actions';
  const editable = ['clients', 'routes'].includes(row.table_name);
  if (editable && row.action === 'update') actions.append(actionButton('Deshacer este cambio', () => confirmUndo(row)));
  if (row.table_name === 'clients' && row.action === 'delete' && !clients[row.row_key]) actions.append(actionButton('Recuperar cliente', () => confirmRestoreClient(row)));
  if (row.table_name === 'clients' && clients[row.row_key]) {
    actions.append(actionButton('Abrir cliente', () => { enterAdminDirectory(); openClient(row.row_key); }));
    actions.append(actionButton('Historial del cliente', () => showClientHistory(row.row_key)));
  }
  if (actions.childElementCount) item.append(actions);
  return item;
}

function actionButton(text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function renderAudit() {
  const list = document.querySelector('#audit-list');
  const { alertsOnly } = auditFilters();
  const rows = alertsOnly ? auditRows.filter(isAlert) : auditRows;
  list.replaceChildren(...rows.map(auditEntry));
  const alerts = auditRows.filter(isAlert).length;
  document.querySelector('#audit-status').textContent = auditRows.length
    ? `${auditRows.length} movimiento${auditRows.length === 1 ? '' : 's'}${alerts ? ` · ${alerts} para revisar` : ''}${alertsOnly ? ' (mostrando solo los de revisar)' : ''}`
    : 'Sin movimientos con estos filtros.';
  document.querySelector('#audit-more').hidden = auditDone || !auditRows.length;
}

function showClientHistory(clientId) {
  const search = document.querySelector('#audit-search');
  search.value = clients[clientId]?.name || clientId;
  document.querySelector('#audit-route').value = '';
  document.querySelector('#audit-actor').value = '';
  document.querySelector('#audit-since').value = '';
  loadAudit();
}

// ── Arreglos ──

function targetFor(row) {
  if (row.table_name === 'clients') return clients[row.row_key] || null;
  if (row.table_name === 'routes') return routeSettlements[row.row_key] || null;
  return null;
}

function afterFix(row) {
  persistBusinessData();
  if (row.table_name === 'clients') renderClientRows(row.row_key);
  else renderClientsBulk(Object.keys(clients));
  if (routeSettlements[routeSelect.value]) renderAdminRoute(routeSelect.value);
}

function confirmUndo(row) {
  const target = targetFor(row);
  if (!target) { showToast('Ese registro ya no existe en este equipo.'); return; }
  const preview = undoAuditChanges(target, row.changes, { dryRun: true, label: fieldLabel, format: shortValue });
  if (!preview.applied.length) {
    showToast(preview.skipped.length ? 'No hay nada que deshacer: esos datos cambiaron después. Ábrelo y corrígelo a mano.' : 'Ese cambio ya está deshecho.');
    return;
  }
  openCustomModal({
    title: 'Deshacer este cambio',
    description: `${TABLE_LABELS[row.table_name]} ${recordName(row)} · ${formatWhen(row.at)} · ${actorName(row)}. Se aplica sobre los datos de hoy, sin borrar lo que pasó después.`,
    submitLabel: 'Deshacer',
    fields: [
      { type: 'note', label: 'Se hará', value: preview.applied.join(' · ') },
      ...(preview.skipped.length ? [{ type: 'note', label: 'No se toca', value: preview.skipped.join(' · ') }] : []),
    ],
    onSubmit: () => {
      const current = targetFor(row);
      if (!current) return;
      const done = undoAuditChanges(current, row.changes, { label: fieldLabel });
      afterFix(row);
      showToast(`Cambio deshecho (${done.applied.length} ajuste${done.applied.length === 1 ? '' : 's'}).`);
      window.setTimeout(() => loadAudit(), 1500);
    },
  });
}

function confirmRestoreClient(row) {
  const data = rebuildDeleted(row.changes);
  if (!data.name) { showToast('No hay datos suficientes para recuperar este cliente.'); return; }
  openCustomModal({
    title: 'Recuperar cliente',
    description: `${data.name} se borró el ${formatWhen(row.at)} (${actorName(row)}). Vuelve con sus datos y abonos de ese momento (las fotos de comprobantes no se recuperan).`,
    submitLabel: 'Recuperar',
    fields: [{ type: 'note', label: 'Saldo', value: shortValue(data.balance, 'balance') }],
    onSubmit: () => {
      if (clients[row.row_key]) { showToast('Ese cliente ya existe.'); return; }
      clients[row.row_key] = data;
      afterFix(row);
      renderClientsBulk(Object.keys(clients));
      showToast(`${data.name} recuperado.`);
      window.setTimeout(() => loadAudit(), 1500);
    },
  });
}

// ── Filtros ──

function fillAuditFilters() {
  const routeFilter = document.querySelector('#audit-route');
  const selectedRoute = routeFilter.value;
  routeFilter.replaceChildren(new Option('Todos los cobros', ''), ...Object.entries(routeSettlements)
    .sort(([, a], [, b]) => String(a?.name).localeCompare(String(b?.name), 'es')).map(([id, route]) => new Option(route?.name || id, id)));
  routeFilter.value = selectedRoute && routeSettlements[selectedRoute] ? selectedRoute : '';
  const actorFilter = document.querySelector('#audit-actor');
  const selectedActor = actorFilter.value;
  actorFilter.replaceChildren(new Option('Todas las personas', ''), ...personnel.filter(worker => worker.id && !String(worker.id).startsWith('worker-'))
    .map(worker => new Option(worker.name || worker.username, worker.id)));
  actorFilter.value = selectedActor;
}

/** Al abrir la sección: filtros al día y primera página (los últimos movimientos). */
export function renderAuditConsole() {
  if (!backendEnabled() || state.userRole !== 'admin') return;
  fillAuditFilters();
  loadAudit();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  const menuItem = document.querySelector('[data-admin-section="audit"]');
  if (!menuItem) return;
  // La consola necesita el servidor (el historial vive allá).
  menuItem.hidden = !backendEnabled();
  menuItem.addEventListener('click', renderAuditConsole);
  document.querySelector('#audit-filters').addEventListener('submit', event => { event.preventDefault(); loadAudit(); });
  document.querySelector('#audit-alerts').addEventListener('change', renderAudit);
  document.querySelector('#audit-more').addEventListener('click', () => loadAudit({ more: true }));
}
