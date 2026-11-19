/**
 * features/admin/audit-console · Consola de movimientos (solo el administrador).
 *
 * Una «terminal» del cobro elegido en el menú (el mismo selector de rutas de siempre): cada
 * línea es un movimiento del día —abono, abono editado o quitado, préstamo, gasto, cambio de
 * base, cierre, cliente nuevo o borrado, choque entre equipos— con la hora y quién lo hizo.
 * Se actualiza sola mientras está abierta. Tocar una línea muestra el detalle y lo que se puede
 * hacer: deshacer, volver a poner lo quitado, editar el valor o abrir el cliente.
 *
 * Lo anota el servidor (supabase/consola.sql). Los arreglos se guardan como cualquier cambio
 * del administrador y también aparecen en la terminal.
 */

import { customModalError, routeSelect } from '../../core/dom.js';
import { backend, backendEnabled, backendErrorMessage } from '../../core/backend.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData, personnel, routeSettlements } from '../../core/store.js';
import { auditItemIdentity, lostItems, rebuildDeleted, undoAuditChanges } from '../../domain/audit-undo.js';
import { localDateISO, shiftDateISO } from '../../shared/dates.js';
import { formatMoney } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';
import { enterAdminDirectory, renderAdminRoute } from './admin-shell.js';
import { openClient } from '../clients/client-detail.js';
import { renderClientRows, renderClientsBulk } from '../clients/directory.js';

const AUDIT_PAGE = 1000;
const AUDIT_POLL_MS = 15000;

const FIELD_LABELS = {
  balance: 'Saldo', payments: 'Abonos', totalPaidAmount: 'Total abonado', paid: 'Pagado', principal: 'Préstamo', total: 'Total a pagar',
  installment: 'Cuota', installments: 'Cuotas', totalDays: 'Días', frequency: 'Frecuencia', status: 'Estado', late: 'Atrasado',
  name: 'Nombre', phone: 'Teléfono', address: 'Dirección', addressNotes: 'Indicaciones', interestPercent: 'Interés %', creditStartDate: 'Inicio del crédito',
  notes: 'Notas', note: 'Nota', route: 'Cobro', location: 'Ubicación', settledAt: 'Pagada el', loanHistory: 'Historial de préstamos', visitHistory: 'Visitas',
  base: 'Base', baseBank: 'Base en banco', loans: 'Préstamos', loansNew: 'Préstamos del día', loansEntered: 'Préstamos ingresados', collections: 'Cobro',
  expenses: 'Gastos', otherExpenses: 'Otros gastos', otherExpenseEntries: 'Gastos', cashDelivered: 'Efectivo entregado',
  cardsCancelled: 'Cartulinas canceladas', monthlyInsurance: 'Seguros del mes', extraInsurance: 'Seguros adicionales', ledger: 'Libro',
  cashBox: 'Caja', insuranceCuts: 'Cortes de seguros', cashEntries: 'Entradas de caja', mondayBase: 'Base del lunes',
  access_enabled: 'Acceso', route_id: 'Cobro asignado', role: 'Rol', username: 'Usuario', data: 'Datos', method: 'Forma de pago', amount: 'Monto', date: 'Fecha',
  transfers: 'Transferencias', cashOut: 'Salida de caja', cashIn: 'Entrada de caja', insurance: 'Seguros', closed: 'Cerrado',
};
const MONEY_FIELDS = new Set(['balance', 'totalPaidAmount', 'paid', 'principal', 'total', 'installment', 'base', 'baseBank', 'loans', 'collections', 'expenses',
  'otherExpenses', 'cashDelivered', 'monthlyInsurance', 'weeklyCollections', 'amount', 'value', 'insurance', 'cash', 'transfers', 'cashOut', 'cashIn']);
// Campos que se recalculan solos o repiten lo que ya dice otra línea: no se muestran.
const QUIET_FIELDS = new Set(['collections', 'weeklyCollections', 'weeklyCardCount', 'lastClosure', 'baseCarriedOn', 'baseCarriedFrom', 'totalPaidAmount',
  'paidPeriodIndexes', 'updatedAt', 'archivedPaymentsAt', 'receiptPurgedAt', 'worstHistory', 'paymentsCount', 'closedTs']);

let auditRows = [];
let auditDay = '';
let auditRoute = '';
let auditTimer = null;
let auditLoading = false;
let auditAlertsOnly = false;
let auditOpenLine = '';

const fieldLabel = path => path.map(key => FIELD_LABELS[key] || key).join(' › ');
const panelOpen = () => state.activeAdminPanel === 'audit' && !document.querySelector('[data-admin-panel="audit"]')?.hidden;

function auditMoney(value) { return formatMoney(Number(value) || 0); }

function shortValue(value, key) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return MONEY_FIELDS.has(key) ? auditMoney(value) : String(value);
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (key === 'method') return value === 'transfer' ? 'transferencia' : 'efectivo';
  if (typeof value === 'string') return value.length > 50 ? `${value.slice(0, 47)}…` : value;
  if (Array.isArray(value)) return `lista de ${value.length}`;
  return itemSummary(value);
}

function auditShortDate(value) {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? `${text.slice(8, 10)}/${text.slice(5, 7)}` : text;
}

/** Un abono, préstamo, gasto… en pocas palabras. */
function itemSummary(item) {
  if (!item || typeof item !== 'object') return String(item ?? '—');
  const amount = [item.amount, item.value, item.principal, item.cash].find(value => typeof value === 'number');
  const parts = [];
  if (item.name || item.clientName) parts.push(item.name || item.clientName);
  if (typeof amount === 'number') parts.push(auditMoney(amount));
  if (item.method) parts.push(item.method === 'transfer' ? 'transferencia' : 'efectivo');
  if (item.date) parts.push(auditShortDate(item.date));
  if (item.note) parts.push(`«${String(item.note).slice(0, 40)}»`);
  return parts.join(' · ') || `${Object.keys(item).length} datos`;
}

function auditClockTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--:--' : date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function actorName(row) {
  if (row.actor_name) return row.actor_name;
  const worker = personnel.find(item => item.id === row.actor);
  return worker?.username || worker?.name || (row.actor ? 'usuario' : 'servidor');
}

function recordName(row) {
  if (row.table_name === 'clients') {
    const fromChanges = (row.changes || []).find(change => change.p?.[0] === 'name');
    return clients[row.row_key]?.name || fromChanges?.new || fromChanges?.old || row.row_key;
  }
  if (row.table_name === 'routes') return 'COBRO';
  if (row.table_name === 'profiles') return personnel.find(item => item.id === row.row_key)?.name || row.row_key;
  if (row.table_name === 'pending_requests') return 'SOLICITUD';
  return row.row_key;
}

// ── De cambios a líneas de la terminal ──

/** Diferencias de un elemento editado (mismo abono antes y después). */
function auditItemEdits(before, after) {
  return [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter(key => !['receipt', 'receiptData', 'at', 'ts', 'id', 'cycle', 'cycleIndex', 'period'].includes(key) && JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
    .map(key => `${FIELD_LABELS[key] || key}: ${shortValue(before?.[key], key)} → ${shortValue(after?.[key], key)}`);
}

const LIST_TAGS = {
  payments: ['ABONO', 'ABONO EDITADO', 'ABONO QUITADO'],
  loansNew: ['PRÉSTAMO', 'PRÉSTAMO EDITADO', 'PRÉSTAMO QUITADO'],
  loansEntered: ['PRÉSTAMO INGRESADO', 'PRÉSTAMO EDITADO', 'PRÉSTAMO QUITADO'],
  otherExpenseEntries: ['GASTO', 'GASTO EDITADO', 'GASTO QUITADO'],
  extraInsurance: ['SEGURO', 'SEGURO EDITADO', 'SEGURO QUITADO'],
  cardsCancelled: ['CANCELADA', 'CANCELADA EDITADA', 'CANCELADA QUITADA'],
  cashEntries: ['ENTRADA CAJA', 'ENTRADA EDITADA', 'ENTRADA QUITADA'],
};

/** Vacío o en cero (null, '', 0, [], {}). */
function auditEmpty(value) {
  if (value === null || value === undefined || value === '' || value === 0 || value === false) return true;
  if (Array.isArray(value)) return !value.length;
  return typeof value === 'object' && !Object.keys(value).length;
}

function auditListLines(change) {
  const key = change.p[change.p.length - 1];
  const [addTag, editTag, removeTag] = LIST_TAGS[key] || [`+ ${fieldLabel(change.p).toUpperCase()}`, 'EDITADO', 'QUITADO'];
  const lines = [];
  const added = [...(change.added || [])];
  const lost = new Set(lostItems(change));
  (change.removed || []).forEach(item => {
    const identity = auditItemIdentity(item);
    const index = identity ? added.findIndex(other => auditItemIdentity(other) === identity) : -1;
    if (index >= 0) {
      const after = added.splice(index, 1)[0];
      const edits = auditItemEdits(item, after);
      if (edits.length) lines.push({ tag: editTag, tone: 'edit', text: `${itemSummary(item)} · ${edits.join(' · ')}`, change, item: after });
      return;
    }
    if (lost.has(item)) lines.push({ tag: removeTag, tone: 'alert', text: itemSummary(item), change, item, lost: true });
  });
  added.forEach(item => lines.push({ tag: addTag, tone: 'add', text: itemSummary(item), change, item }));
  return lines;
}

function auditRowLines(row) {
  const changes = row.changes || [];
  if (row.action === 'merge') {
    // Dos celulares cambiaron lo mismo a la vez y la app juntó los dos cambios (no se pierde nada:
    // si algo se hubiera quitado, sale aparte como «QUITADO»). Los montos que se recalculan solos no cuentan.
    const shown = changes.filter(change => !QUIET_FIELDS.has(change.p?.[0]));
    if (!shown.length) return [];
    return [{ tag: '⇄ COMBINADO', tone: 'info', text: `dos celulares cambiaron a la vez y se juntaron los dos · ${shown.map(change => fieldLabel(change.p || [])).join(', ')}` }];
  }
  const find = key => changes.find(change => change.p?.length === 1 && change.p[0] === key);
  if (row.table_name === 'clients' && row.action === 'insert') {
    return [{ tag: 'CLIENTE NUEVO', tone: 'add', text: `préstamo ${auditMoney(find('principal')?.new)} · cuota ${auditMoney(find('installment')?.new)} · saldo ${auditMoney(find('balance')?.new)}` }];
  }
  if (row.action === 'delete') {
    return [{ tag: row.table_name === 'clients' ? 'CLIENTE BORRADO' : 'BORRADO', tone: 'alert', text: row.table_name === 'clients' ? `saldo ${auditMoney(find('balance')?.old)}` : row.row_key, restorable: row.table_name === 'clients' }];
  }
  if (row.table_name === 'profiles') {
    const access = changes.find(change => change.p?.[0] === 'access_enabled');
    if (access) return [{ tag: access.new === false ? 'ACCESO OFF' : 'ACCESO ON', tone: access.new === false ? 'alert' : 'add', text: recordName(row) }];
  }
  const lines = [];
  const paymentsChanged = changes.some(change => change.p?.[0] === 'payments');
  const archived = changes.some(change => change.p?.[0] === 'archivedPaymentsAt' && change.new);
  changes.forEach(change => {
    const path = change.p || [];
    if (!path.length || QUIET_FIELDS.has(path[0]) || QUIET_FIELDS.has(path[path.length - 1])) return;
    // Cartulina pagada hace una semana: sus abonos se archivan (no es una pisada).
    if (path[0] === 'payments' && archived && !(change.added || []).length) {
      lines.push({ tag: 'ARCHIVADA', tone: 'dim-info', text: `cartulina pagada: ${(change.removed || []).length} abonos archivados (pasa a la semana de pagarse)` });
      return;
    }
    if ('added' in change || 'removed' in change) { lines.push(...auditListLines(change)); return; }
    if (path[0] === 'ledger' && path.length === 2) {
      const closedNow = change.new && typeof change.new === 'object' && change.new.closed && !(change.old && change.old.closed);
      if (closedNow) { lines.push({ tag: 'CIERRE', tone: 'info', text: `${auditShortDate(path[1])} · efectivo ${auditMoney(change.new.cashDelivered)} · transferencias ${auditMoney(change.new.transfers)}` }); return; }
      const edits = auditItemEdits(change.old, change.new);
      if (edits.length) lines.push({ tag: 'LIBRO', tone: 'edit', text: `${auditShortDate(path[1])} · ${edits.join(' · ')}` });
      return;
    }
    // El saldo cambia con cada abono: en ese caso va junto al abono, no en otra línea.
    if (path[0] === 'balance' && paymentsChanged) return;
    const key = path[path.length - 1];
    // Solo lo que tiene nombre conocido y cambió de verdad (ajustes internos de la app: no).
    if (!FIELD_LABELS[key] || (auditEmpty(change.old) && auditEmpty(change.new)) || shortValue(change.old, key) === shortValue(change.new, key)) return;
    lines.push({ tag: path[0] === 'base' ? 'BASE' : 'CAMBIO', tone: 'edit', text: `${fieldLabel(path)}: ${shortValue(change.old, key)} → ${shortValue(change.new, key)}`, change, editable: typeof change.new !== 'object' || change.new === null });
  });
  const balance = find('balance');
  if (paymentsChanged && balance && lines.length) lines[lines.length - 1].suffix = `saldo ${auditMoney(balance.old)} → ${auditMoney(balance.new)}`;
  return lines;
}

// ── Datos ──

function auditDayRange(dateISO) {
  const start = new Date(`${dateISO}T00:00:00`);
  const end = new Date(`${shiftDateISO(dateISO, 1)}T00:00:00`);
  return [start.toISOString(), end.toISOString()];
}

async function fetchAuditSince(afterId) {
  const db = await backend();
  const [from, to] = auditDayRange(auditDay);
  const rows = [];
  let last = afterId;
  for (;;) {
    let query = db.from('audit_log').select('*').eq('route_id', auditRoute).gte('at', from).lt('at', to);
    if (last) query = query.gt('id', last);
    const { data, error } = await query.order('id', { ascending: true }).limit(AUDIT_PAGE);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < AUDIT_PAGE) return rows;
    last = data[data.length - 1].id;
  }
}

async function loadAudit({ fresh = false } = {}) {
  if (auditLoading || !auditRoute) return;
  auditLoading = true;
  const status = document.querySelector('#audit-status');
  if (fresh) { auditRows = []; status.textContent = 'cargando…'; renderAudit(); }
  try {
    const afterId = auditRows.length ? auditRows[auditRows.length - 1].id : 0;
    const route = auditRoute;
    const day = auditDay;
    const rows = await fetchAuditSince(afterId);
    if (route !== auditRoute || day !== auditDay) return;
    if (rows.length || fresh) { auditRows.push(...rows); renderAudit({ scroll: rows.length > 0 }); }
    status.textContent = auditDay === localDateISO() ? `en vivo · ${auditClockTime(new Date())}` : 'día cerrado';
  } catch (error) {
    status.textContent = /audit_log|relation|does not exist|schema cache/i.test(String(error?.message))
      ? 'falta activar el historial en el servidor'
      : `sin conexión: ${backendErrorMessage(error)}`;
  } finally { auditLoading = false; }
}

function scheduleAuditPoll() {
  window.clearTimeout(auditTimer);
  if (!panelOpen() || auditDay !== localDateISO()) return;
  auditTimer = window.setTimeout(async () => { if (panelOpen() && !document.hidden) await loadAudit(); scheduleAuditPoll(); }, AUDIT_POLL_MS);
}

// ── Pantalla ──

function auditLineNode(row, line, index) {
  const id = `${row.id}:${index}`;
  const node = document.createElement('div');
  node.className = `term-line is-${line.tone}`;
  node.dataset.line = id;
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  const cells = [
    ['term-time', auditClockTime(row.at)],
    ['term-who', actorName(row)],
    ['term-tag', line.tag],
    ['term-what', row.table_name === 'clients' || row.table_name === 'profiles' ? recordName(row) : ''],
    ['term-text', line.text + (line.suffix ? `  (${line.suffix})` : '')],
  ];
  cells.forEach(([className, text]) => { const cell = document.createElement('span'); cell.className = className; cell.textContent = text; node.append(cell); });
  const toggle = () => { auditOpenLine = auditOpenLine === id ? '' : id; renderAudit(); };
  node.addEventListener('click', toggle);
  node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
  return node;
}

function auditActionsNode(row, line) {
  const box = document.createElement('div');
  box.className = 'term-actions';
  const add = (text, onClick) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = `[ ${text} ]`; button.addEventListener('click', event => { event.stopPropagation(); onClick(); }); box.append(button); };
  const fixable = ['clients', 'routes'].includes(row.table_name);
  if (fixable && line.lost) add('volver a poner', () => confirmUndo(row, [line.change], 'Volver a poner'));
  if (fixable && line.change && !line.lost && row.action === 'update') add('deshacer', () => confirmUndo(row, [line.change], 'Deshacer'));
  if (fixable && row.action === 'update' && (row.changes || []).length > 1) add('deshacer todo el movimiento', () => confirmUndo(row, row.changes, 'Deshacer todo'));
  if (fixable && line.editable && line.change) add('editar', () => auditEditValue(row, line.change));
  if (line.restorable && !clients[row.row_key]) add('recuperar cliente', () => confirmRestoreClient(row));
  if (row.table_name === 'clients' && clients[row.row_key]) add('abrir cliente', () => { enterAdminDirectory(); openClient(row.row_key); });
  if (!box.childElementCount) { const note = document.createElement('span'); note.textContent = 'sin acciones para esta línea'; box.append(note); }
  return box;
}

function renderAudit({ scroll = false } = {}) {
  const screen = document.querySelector('#audit-screen');
  if (!screen) return;
  const search = String(document.querySelector('#audit-search')?.value || '').trim().toLocaleLowerCase('es');
  const atBottom = screen.scrollHeight - screen.scrollTop - screen.clientHeight < 40;
  const nodes = [];
  let total = 0;
  let alerts = 0;
  auditRows.forEach(row => {
    const name = recordName(row).toLocaleLowerCase('es');
    auditRowLines(row).forEach((line, index) => {
      total += 1;
      if (line.tone === 'alert') alerts += 1;
      if (auditAlertsOnly && line.tone !== 'alert') return;
      if (search && !name.includes(search) && !line.text.toLocaleLowerCase('es').includes(search) && !actorName(row).toLocaleLowerCase('es').includes(search)) return;
      nodes.push(auditLineNode(row, line, index));
      if (auditOpenLine === `${row.id}:${index}`) nodes.push(auditActionsNode(row, line));
    });
  });
  const routeName = routeSettlements[auditRoute]?.name || auditRoute || '—';
  const head = document.createElement('div');
  head.className = 'term-line is-dim';
  head.textContent = `$ movimientos --cobro "${routeName}" --dia ${auditDay}${auditAlertsOnly ? ' --solo-alertas' : ''}${search ? ` --buscar "${search}"` : ''}`;
  const tail = document.createElement('div');
  tail.className = 'term-line is-dim';
  tail.textContent = auditRows.length || !auditLoading ? `${total} movimiento${total === 1 ? '' : 's'} · ${alerts} para revisar` : '';
  const cursor = document.createElement('span');
  cursor.className = 'term-cursor';
  tail.append(cursor);
  const empty = document.createElement('div');
  empty.className = 'term-line is-dim';
  empty.textContent = auditLoading && !auditRows.length ? 'cargando…' : 'sin movimientos';
  screen.replaceChildren(head, ...(nodes.length ? nodes : [empty]), tail);
  if (scroll && atBottom) screen.scrollTop = screen.scrollHeight;
  document.querySelector('#audit-alerts')?.setAttribute('aria-pressed', String(auditAlertsOnly));
  document.querySelector('#audit-day-label').textContent = auditDay === localDateISO() ? 'HOY' : auditShortDate(auditDay) + '/' + auditDay.slice(0, 4);
  document.querySelector('#audit-next').disabled = auditDay >= localDateISO();
  document.querySelector('#audit-route-name').textContent = routeName;
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
  window.setTimeout(() => loadAudit(), 2500);
}

function confirmUndo(row, changes, title) {
  const target = targetFor(row);
  if (!target) { showToast('Ese registro ya no existe.'); return; }
  const preview = undoAuditChanges(target, changes, { dryRun: true, label: fieldLabel, format: shortValue });
  if (!preview.applied.length) {
    showToast(preview.skipped.length ? 'No hay nada que deshacer: esos datos cambiaron después. Usa «editar» o abre el cliente.' : 'Ya está así: no hay nada que deshacer.');
    return;
  }
  openCustomModal({
    title,
    description: `${recordName(row)} · ${auditClockTime(row.at)} · ${actorName(row)}. Se aplica sobre los datos de hoy, sin borrar lo que pasó después.`,
    submitLabel: title,
    fields: [
      { type: 'note', label: 'Se hará', value: preview.applied.join(' · ') },
      ...(preview.skipped.length ? [{ type: 'note', label: 'No se toca', value: preview.skipped.join(' · ') }] : []),
    ],
    onSubmit: () => {
      const current = targetFor(row);
      if (!current) return;
      const done = undoAuditChanges(current, changes, { label: fieldLabel });
      afterFix(row);
      showToast(`Listo (${done.applied.length} ajuste${done.applied.length === 1 ? '' : 's'}).`);
    },
  });
}

/** Editar a mano el valor actual de un campo (base, teléfono, cuota…). */
function auditEditValue(row, change) {
  const target = targetFor(row);
  const path = change.p || [];
  if (!target || !path.length) { showToast('Ese registro ya no existe.'); return; }
  let parent = target;
  for (const key of path.slice(0, -1)) { if (!parent[key] || typeof parent[key] !== 'object') parent[key] = {}; parent = parent[key]; }
  const key = path[path.length - 1];
  const current = parent[key];
  const numeric = typeof current === 'number' || typeof change.new === 'number' || typeof change.old === 'number';
  const boolean = typeof current === 'boolean' || typeof change.new === 'boolean';
  const field = boolean
    ? { name: 'value', label: fieldLabel(path), type: 'select', value: current ? 'true' : 'false', options: [{ value: 'true', label: 'sí' }, { value: 'false', label: 'no' }] }
    : numeric
      ? { name: 'value', label: fieldLabel(path), type: 'number', money: MONEY_FIELDS.has(key), thousands: MONEY_FIELDS.has(key), step: 1, value: Number(current) || 0, required: true }
      : { name: 'value', label: fieldLabel(path), value: current ?? '', required: false };
  openCustomModal({
    title: `Editar ${fieldLabel(path)}`,
    description: `${recordName(row)} · valor de hoy: ${shortValue(current, key)} · antes de este movimiento: ${shortValue(change.old, key)}.`,
    submitLabel: 'Guardar',
    fields: [field],
    onSubmit: values => {
      let value = values.value;
      if (boolean) value = value === 'true';
      else if (numeric) { value = Math.round(Number(value)); if (!Number.isFinite(value)) { customModalError.textContent = 'Escribe un número.'; return false; } }
      else value = String(value ?? '').trim();
      const fresh = targetFor(row);
      if (!fresh) return;
      let node = fresh;
      for (const part of path.slice(0, -1)) { if (!node[part] || typeof node[part] !== 'object') node[part] = {}; node = node[part]; }
      node[key] = value;
      afterFix(row);
      showToast(`${fieldLabel(path)}: ${shortValue(value, key)}.`);
    },
  });
}

function confirmRestoreClient(row) {
  const data = rebuildDeleted(row.changes);
  if (!data.name) { showToast('No hay datos suficientes para recuperar este cliente.'); return; }
  openCustomModal({
    title: 'Recuperar cliente',
    description: `${data.name} se borró a las ${auditClockTime(row.at)} (${actorName(row)}). Vuelve con sus datos y abonos de ese momento (las fotos de comprobantes no se recuperan).`,
    submitLabel: 'Recuperar',
    fields: [{ type: 'note', label: 'Saldo', value: shortValue(data.balance, 'balance') }],
    onSubmit: () => {
      if (clients[row.row_key]) { showToast('Ese cliente ya existe.'); return; }
      clients[row.row_key] = data;
      afterFix(row);
      renderClientsBulk(Object.keys(clients));
      showToast(`${data.name} recuperado.`);
    },
  });
}

// ── Ciclo ──

/** Al abrir la sección o cambiar de cobro: la terminal del cobro elegido, hoy. */
export function renderAuditConsole({ keepDay = false } = {}) {
  if (!backendEnabled() || state.userRole !== 'admin') return;
  const route = routeSelect.value;
  const changed = route !== auditRoute;
  auditRoute = route;
  if (!keepDay || !auditDay) auditDay = localDateISO();
  if (changed || !keepDay) auditOpenLine = '';
  loadAudit({ fresh: true });
  scheduleAuditPoll();
}

function setAuditDay(day) {
  auditDay = day > localDateISO() ? localDateISO() : day;
  auditOpenLine = '';
  loadAudit({ fresh: true });
  scheduleAuditPoll();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  const menuItem = document.querySelector('[data-admin-section="audit"]');
  if (!menuItem) return;
  // La consola necesita el servidor (el historial vive allá).
  menuItem.hidden = !backendEnabled();
  menuItem.addEventListener('click', () => renderAuditConsole());
  routeSelect.addEventListener('change', () => { if (panelOpen()) renderAuditConsole({ keepDay: true }); });
  document.querySelector('#audit-prev').addEventListener('click', () => setAuditDay(shiftDateISO(auditDay, -1)));
  document.querySelector('#audit-next').addEventListener('click', () => setAuditDay(shiftDateISO(auditDay, 1)));
  document.querySelector('#audit-day-label').addEventListener('click', () => setAuditDay(localDateISO()));
  document.querySelector('#audit-alerts').addEventListener('click', () => { auditAlertsOnly = !auditAlertsOnly; renderAudit(); });
  document.querySelector('#audit-search').addEventListener('input', () => renderAudit());
  document.addEventListener('visibilitychange', () => { if (!document.hidden && panelOpen()) { loadAudit(); scheduleAuditPoll(); } });
}
