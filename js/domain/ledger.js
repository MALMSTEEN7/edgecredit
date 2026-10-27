/**
 * domain/ledger · Libro diario de cada cobro (ruta) y caja del cobro.
 *
 * - `route.ledger[yyyy-mm-dd]` guarda los datos de cada día: base, cobro, préstamos,
 *   gastos, otros gastos, efectivo, salida de caja y seguros. Se escribe al cerrar el
 *   cobro («Verificar y cerrar ruta») y se puede corregir desde Reportes (gastos, otros
 *   gastos y salida de caja). Nada se borra: cualquier fecha se puede consultar después.
 * - El día de hoy, mientras no se cierre, se lee de los valores vivos de la ruta.
 * - `route.cashBox` es la CAJA del cobro: el monto de apertura (dinero disponible para
 *   prestar). No se reinicia nunca; cada día suma el cobro y resta préstamos, gastos,
 *   otros gastos y salidas de caja, y suma las ENTRADAS de caja (capital que se inyecta:
 *   `ledger[día].cashIn`, con su detalle en `route.cashEntries`). La apertura no se edita:
 *   un cobro sin apertura empieza en $0 y su capital inicial entra como una entrada.
 * - Solo se guardan los cierres de los últimos LEDGER_MONTHS_KEPT meses (pruneOldLedger):
 *   lo que movieron los días borrados queda sumado en la apertura, así la caja no cambia.
 * - `route.insuranceCuts` registra cada «Cuadrar seguros».
 * - Días traídos del sistema anterior (Excel): `cashAdjustment` es el ajuste de caja de ese
 *   día (descuadre entregado de más o de menos, o un ingreso de capital) para que la caja
 *   quede igual a la del Excel. Lo explica `adjustmentNote`. Los días de EdgeCredit no lo usan.
 */

import { localDateISO, shiftDateISO } from '../shared/dates.js';
import { formatMoney } from '../shared/format.js';

export const DAY_FIELDS = ['base', 'collections', 'loans', 'expenses', 'otherExpenses', 'cashDelivered', 'cashOut', 'cashIn', 'insurance'];
const LIVE_FIELDS = ['base', 'collections', 'loans', 'expenses', 'otherExpenses', 'cashDelivered'];
export const EDITABLE_FIELDS = ['expenses', 'otherExpenses', 'cashOut'];

export function ensureLedger(route) {
  if (!route) return route;
  route.ledger ||= {};
  route.cashBox ||= { opening: 0, openingDate: null };
  route.insuranceCuts ||= [];
  route.cashEntries ||= [];
  return route;
}

function closedToday(route) {
  return route.lastClosure?.date === localDateISO();
}

/**
 * Datos de un día. Hoy sin cerrar = valores vivos de la ruta (+ salida de caja anotada).
 * `otherExpenses` incluye el sueldo del trabajador que anotó el admin (`salary`): lo paga la
 * caja del cobro, pero no hace parte de lo que entrega el trabajador (no genera descuadre).
 */
export function dayRecord(route, dateISO, liveInsurance = 0) {
  ensureLedger(route);
  const stored = route.ledger[dateISO];
  const today = localDateISO();
  const salary = Number(stored?.salary || 0);
  if (dateISO === today && !closedToday(route)) {
    const live = Object.fromEntries(LIVE_FIELDS.map(field => [field, Number(route[field] || 0)]));
    return { ...live, otherExpenses: live.otherExpenses + salary, salary, cashOut: Number(stored?.cashOut || 0), cashIn: Number(stored?.cashIn || 0), insurance: liveInsurance, closed: false, live: true };
  }
  if (!stored) return { ...Object.fromEntries(DAY_FIELDS.map(field => [field, 0])), salary: 0, closed: false, empty: true };
  const record = Object.fromEntries(DAY_FIELDS.map(field => [field, Number(stored[field] || 0)]));
  return {
    ...record, otherExpenses: record.otherExpenses + salary, salary,
    cashAdjustment: Number(stored.cashAdjustment || 0), adjustmentNote: stored.adjustmentNote || '',
    closed: Boolean(stored.closed), demo: Boolean(stored.demo),
  };
}

/** Descuadre del día (fórmula de la liquidación). Solo aplica a días cerrados; el sueldo no cuenta. */
export function ledgerDifference(record) {
  if (!record.closed) return null;
  return record.collections + record.base - record.loans - record.expenses - (record.otherExpenses - Number(record.salary || 0)) - record.cashDelivered;
}

/** Movimiento de la caja del cobro en un día. */
export function cashBoxMovement(record) {
  return record.collections - record.loans - record.expenses - record.otherExpenses - record.cashOut + Number(record.cashIn || 0) + Number(record.cashAdjustment || 0);
}

/** Caja al cierre del día indicado (incluye hoy en vivo si la fecha llega a hoy). */
export function cashBoxAt(route, dateISO, liveInsurance = 0) {
  ensureLedger(route);
  const { opening, openingDate } = route.cashBox;
  if (openingDate && dateISO < openingDate) return null; // sin apertura: desde el primer cierre, en $0
  const today = localDateISO();
  let total = Number(opening || 0);
  Object.keys(route.ledger).forEach(date => {
    if ((openingDate && date < openingDate) || date > dateISO) return;
    if (date === today && !closedToday(route)) return; // hoy se suma en vivo abajo
    total += cashBoxMovement(dayRecord(route, date));
  });
  if ((!openingDate || today >= openingDate) && today <= dateISO && !closedToday(route)) total += cashBoxMovement(dayRecord(route, today, liveInsurance));
  return total;
}

export const LEDGER_MONTHS_KEPT = 4;

/** Primer día que se conserva: el mismo día de hace 4 meses (24-oct → 24-jun). */
export function ledgerCutoff(today = localDateISO()) {
  const [year, month, day] = today.split('-').map(Number);
  const lastDay = new Date(year, month - 1 - LEDGER_MONTHS_KEPT + 1, 0).getDate();
  return localDateISO(new Date(year, month - 1 - LEDGER_MONTHS_KEPT, Math.min(day, lastDay)));
}

/**
 * Borra los cierres de más de 4 meses. Lo que movieron esos días pasa a la apertura y la
 * apertura se corre a la fecha de corte: la caja de hoy (y la de los días que quedan) no
 * cambia. Devuelve true si borró algo.
 */
export function pruneOldLedger(route, today = localDateISO()) {
  ensureLedger(route);
  const cutoff = ledgerCutoff(today);
  const old = Object.keys(route.ledger).filter(date => date < cutoff).sort();
  if (!old.length) return false;
  const { openingDate } = route.cashBox;
  if (!openingDate || openingDate < cutoff) {
    const opening = old.filter(date => !openingDate || date >= openingDate)
      .reduce((total, date) => total + cashBoxMovement(dayRecord(route, date)), Number(openingDate ? route.cashBox.opening || 0 : 0));
    route.cashBox = { ...route.cashBox, opening, openingDate: cutoff, prunedBefore: cutoff };
  }
  old.forEach(date => { delete route.ledger[date]; });
  route.cashEntries = route.cashEntries.filter(entry => entry.date >= cutoff);
  Object.entries(route.weeklySalaries || {}).forEach(([week, salary]) => { if (salary.date < cutoff) delete route.weeklySalaries[week]; });
  return true;
}

/**
 * Entrada de caja: capital que se inyecta al cobro (o el capital con que se abre un cobro
 * nuevo). Suma a la caja ese día y queda el detalle de quién, cuándo y por qué.
 */
export function addCashEntry(route, amount, { date = localDateISO(), by = 'Administrador', note = '' } = {}) {
  ensureLedger(route);
  const value = Math.round(Number(amount) || 0);
  if (value <= 0) return null;
  route.ledger[date] ||= { closed: false };
  route.ledger[date].cashIn = Number(route.ledger[date].cashIn || 0) + value;
  const entry = { id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, date, amount: value, by, note: String(note || '').trim(), ts: Date.now() };
  route.cashEntries.push(entry);
  return entry;
}

/** Guarda el día al cerrar el cobro (antes de reiniciar los valores vivos). */
export function recordClosure(route, dateISO, values, closedTs) {
  ensureLedger(route);
  const previous = route.ledger[dateISO] || {};
  route.ledger[dateISO] = {
    ...previous,
    ...Object.fromEntries(LIVE_FIELDS.map(field => [field, Number(values[field] || 0)])),
    insurance: Number(previous.closed ? previous.insurance || 0 : 0) + Number(values.insurance || 0),
    cashOut: Number(previous.cashOut || 0),
    // Abonos del día recibidos por transferencia: no pasan a la base del día siguiente.
    transfers: Number(values.transfers || 0),
    closed: true,
    closedTs,
    demo: false,
  };
}

/** Efectivo con que terminó un día cerrado: el entregado o, si no se anotó, el calculado. */
export function closedDayCash(record) {
  const computed = record.collections + record.base - record.loans - record.expenses - (record.otherExpenses - Number(record.salary || 0));
  return Number(record.cashDelivered || 0) > 0 ? Number(record.cashDelivered) : Math.max(0, computed);
}

/**
 * Base que le toca hoy a la ruta: el efectivo del último día cerrado antes de hoy (sirve
 * también para los días traídos del Excel), sin los abonos de ese día que llegaron por
 * transferencia: esa plata está en el banco, no en la mano del trabajador. Si ese día fue
 * sábado el efectivo se entregó y la base arranca en 0 (o en la base para el lunes que el
 * admin asignó ese sábado), igual que al cerrar en Liquidación.
 * `transfersOn(fecha)` da las transferencias de un cierre que no las guardó. Devuelve null
 * sin cierres previos.
 */
export function carriedBase(route, today = localDateISO(), transfersOn = () => 0) {
  ensureLedger(route);
  const last = Object.keys(route.ledger).filter(date => date < today && route.ledger[date]?.closed).sort().at(-1);
  if (!last) return null;
  const [year, month, day] = last.split('-').map(Number);
  const saturday = new Date(year, month - 1, day).getDay() === 6;
  const stored = route.ledger[last].transfers;
  const transfers = Number(stored ?? transfersOn(last)) || 0;
  const amount = saturday ? mondayBaseFor(route, last) : Math.max(0, closedDayCash(dayRecord(route, last)) - transfers);
  return { date: last, amount, transfers, saturday };
}

/**
 * Base para el lunes que el admin dejó asignada el sábado `saturdayISO` (0 si no dejó ninguna).
 * Es la única forma de que un trabajador empiece la semana con base.
 */
export function mondayBaseFor(route, saturdayISO) {
  return route?.mondayBase?.date === saturdayISO ? Math.max(0, Number(route.mondayBase.amount) || 0) : 0;
}

/**
 * Comentario de «otros gastos» de un día: el que dejó el admin o, si no lo ha cambiado, lo que
 * anotó el trabajador al registrar cada gasto («Pinchada ($ 12.000)»). El sueldo va aparte (daySalary).
 */
export function otherExpensesNote(route, dateISO) {
  ensureLedger(route);
  const stored = route.ledger[dateISO]?.otherExpensesNote;
  if (typeof stored === 'string') return stored;
  return (route.otherExpenseEntries || [])
    .filter(entry => (entry.date || String(entry.createdAt || '').slice(0, 10)) === dateISO)
    .map(entry => `${entry.note || 'Sin descripción'} (${formatMoney(entry.amount)})`)
    .join('\n');
}

export function setOtherExpensesNote(route, dateISO, text) {
  ensureLedger(route);
  route.ledger[dateISO] ||= { closed: false };
  route.ledger[dateISO].otherExpensesNote = String(text || '').trim();
}

/** Comentario de la salida de caja de un día (a dónde o para qué salió la plata). */
export function cashOutNote(route, dateISO) {
  ensureLedger(route);
  return String(route.ledger[dateISO]?.cashOutNote || '');
}

export function setCashOutNote(route, dateISO, text) {
  ensureLedger(route);
  route.ledger[dateISO] ||= { closed: false };
  route.ledger[dateISO].cashOutNote = String(text || '').trim();
}

/** Sueldo del trabajador anotado ese día (ya está sumado en «otros gastos»). */
export function daySalary(route, dateISO) {
  ensureLedger(route);
  return Number(route.ledger[dateISO]?.salary || 0);
}

/**
 * Sueldo de la semana que empieza en `weekFrom`. Queda en el día `dateISO` (el sábado, o hoy
 * si la semana va en curso) y se ve sumado a «otros gastos» de ese día (dayRecord). Al
 * cambiarlo se reemplaza en el mismo día. Devuelve la fecha donde quedó.
 */
export function setWeekSalary(route, weekFrom, dateISO, amount) {
  ensureLedger(route);
  route.weeklySalaries ||= {};
  const previous = route.weeklySalaries[weekFrom];
  const date = previous?.date || dateISO;
  const value = Math.max(0, Math.round(Number(amount) || 0));
  route.ledger[date] ||= { closed: false };
  route.ledger[date].salary = value;
  if (value) route.weeklySalaries[weekFrom] = { amount: value, date };
  else delete route.weeklySalaries[weekFrom];
  return date;
}

/** Corrige gastos, otros gastos o salida de caja de un día. Hoy sin cerrar: va a la ruta viva. */
export function setDayField(route, dateISO, field, value) {
  if (!EDITABLE_FIELDS.includes(field)) return;
  ensureLedger(route);
  // En la tabla «otros gastos» se ve con el sueldo incluido: se guarda sin él.
  const salary = field === 'otherExpenses' ? Number(route.ledger[dateISO]?.salary || 0) : 0;
  const amount = Math.max(0, Math.round(Number(value) || 0) - salary);
  if (dateISO === localDateISO() && !closedToday(route) && field !== 'cashOut') {
    route[field] = amount;
    return;
  }
  route.ledger[dateISO] ||= { closed: false };
  route.ledger[dateISO][field] = amount;
  if (route.ledger[dateISO].demo) route.ledger[dateISO].edited = true;
}

// ── Seguros: entradas por día y cortes («Cuadrar seguros») ──

function monthStartTs(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month - 1, 1).getTime();
}

function monthEndTs(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month, 1).getTime() - 1;
}

/**
 * Seguros del día como movimientos con hora: los días cerrados toman la hora del
 * cierre; hoy (en vivo) toma la hora de cada alta.
 */
export function insuranceEntries(route, liveEntries = []) {
  ensureLedger(route);
  const entries = Object.entries(route.ledger)
    .filter(([, record]) => Number(record.insurance) > 0)
    .map(([date, record]) => ({ date, ts: Number(record.closedTs) || new Date(`${date}T19:00:00`).getTime(), amount: Number(record.insurance) }));
  return entries.concat(liveEntries).sort((a, b) => a.ts - b.ts);
}

/** Fin del periodo de seguros de un mes: el último cuadre hecho en ese mes o, si no hubo, fin de mes. */
function periodEnd(route, monthValue) {
  const start = monthStartTs(monthValue);
  const end = monthEndTs(monthValue);
  const cuts = route.insuranceCuts.filter(cut => cut.ts >= start && cut.ts <= end);
  return cuts.length ? Math.max(...cuts.map(cut => cut.ts)) : end;
}

function previousMonth(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Bolsa de seguros del mes. Empieza donde terminó la del mes anterior: si el mes anterior
 * se cuadró antes de fin de mes, lo cobrado después de ese cuadre pasa a este mes.
 */
export function insurancePeriod(route, monthValue, liveEntries = []) {
  ensureLedger(route);
  const from = periodEnd(route, previousMonth(monthValue));
  const to = periodEnd(route, monthValue);
  const all = insuranceEntries(route, liveEntries);
  const inPeriod = all.filter(entry => entry.ts > from && entry.ts <= to);
  const start = monthStartTs(monthValue);
  const carried = inPeriod.filter(entry => entry.ts < start).reduce((sum, entry) => sum + entry.amount, 0);
  const total = inPeriod.reduce((sum, entry) => sum + entry.amount, 0);
  const cuts = route.insuranceCuts.filter(cut => cut.ts >= start && cut.ts <= monthEndTs(monthValue)).sort((a, b) => a.ts - b.ts);
  const lastCut = cuts.at(-1) || null;
  // Lo cobrado en este mes después del último cuadre pasa al mes siguiente.
  const rollover = lastCut ? all.filter(entry => entry.ts > lastCut.ts && entry.ts <= monthEndTs(monthValue)).reduce((sum, entry) => sum + entry.amount, 0) : 0;
  return { entries: inPeriod, total, carried, cuts, lastCut, rollover, from, to };
}

function monthOf(ts) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Seguros que se cuadrarían en el instante `cutTs`: lo cobrado desde el límite anterior
 * (fin del periodo del mes previo o el último cuadre antes de ese instante).
 */
export function insuranceDueAt(route, cutTs, liveEntries = []) {
  ensureLedger(route);
  const since = Math.max(
    periodEnd(route, previousMonth(monthOf(cutTs))),
    ...route.insuranceCuts.filter(cut => cut.ts < cutTs && monthOf(cut.ts) === monthOf(cutTs)).map(cut => cut.ts),
  );
  return insuranceEntries(route, liveEntries).filter(entry => entry.ts > since && entry.ts <= cutTs).reduce((sum, entry) => sum + entry.amount, 0);
}

/** Quita el último cuadre del mes indicado (solo en modo de prueba). */
export function undoLastInsuranceCut(route, monthValue) {
  ensureLedger(route);
  const cuts = route.insuranceCuts.filter(cut => monthOf(cut.ts) === monthValue).sort((a, b) => a.ts - b.ts);
  const last = cuts.at(-1);
  if (!last) return null;
  route.insuranceCuts = route.insuranceCuts.filter(cut => cut !== last);
  return last;
}

/** Registra un cuadre de seguros ahora. */
export function cutInsurance(route, amount, by = 'Administrador', ts = Date.now()) {
  ensureLedger(route);
  const cut = { ts, date: localDateISO(new Date(ts)), amount: Math.round(Number(amount) || 0), by };
  route.insuranceCuts.push(cut);
  return cut;
}

/**
 * Último «Verificar y cerrar ruta»: fecha del día cerrado y momento del cierre (0 si no se
 * sabe, p. ej. días traídos del Excel). Null si la ruta nunca se ha cerrado.
 */
export function closureCutoff(route) {
  ensureLedger(route);
  const closure = route.lastClosure?.date ? { date: route.lastClosure.date, ts: Date.parse(route.lastClosure.submittedAt) || 0 } : null;
  const lastClosed = Object.keys(route.ledger).filter(date => route.ledger[date]?.closed).sort().at(-1);
  if (lastClosed && (!closure || lastClosed > closure.date)) return { date: lastClosed, ts: Number(route.ledger[lastClosed].closedTs) || 0 };
  return closure;
}

/**
 * ¿El abono sigue pendiente de cierre? Son los registrados después del último cierre, aunque
 * sean de días anteriores en que no se cerró la ruta: esos suman en el cobro hasta que se cierre.
 * Los del mismo día del cierre sin hora (`at`) se toman como anteriores al cierre.
 */
export function isPendingPayment(payment, cutoff, today = localDateISO()) {
  if (!payment || !(Number(payment.amount) > 0) || payment.date > today) return false;
  if (!cutoff || payment.date > cutoff.date) return true;
  return payment.date === cutoff.date && Boolean(cutoff.ts) && Boolean(payment.at) && Date.parse(payment.at) > cutoff.ts;
}

/** Abonos de la ruta pendientes de cierre ({ clientId, client, payment }), del más reciente al más antiguo. */
export function pendingRoutePayments(clientsById, routeId, route) {
  const cutoff = route ? closureCutoff(route) : null;
  const today = localDateISO();
  return Object.entries(clientsById)
    .filter(([, client]) => client?.route === routeId)
    .flatMap(([clientId, client]) => (client.payments || [])
      .filter(payment => isPendingPayment(payment, cutoff, today))
      .map(payment => ({ clientId, client, payment })))
    .sort((a, b) => String(b.payment.at || `${b.payment.date}T00`).localeCompare(String(a.payment.at || `${a.payment.date}T00`)));
}

/** Fecha y hora en que se registró un abono: «dom 26 oct · 3:05 p. m.» (sin hora si no se guardó). */
export function paymentStamp(payment) {
  const day = new Date(`${payment.date}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '').replace(' de ', ' ');
  const time = payment.at ? new Date(payment.at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  return [day, time].filter(Boolean).join(' · ');
}
