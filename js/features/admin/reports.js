/**
 * features/admin/reports · Reportes financieros por cobro.
 *
 * Cierre semanal: semanas de lunes a sábado dentro del mes (4 o 5). Cada fila es un día
 * del libro diario (domain/ledger): base, cobro, préstamos, gastos, otros gastos, salida
 * de caja, efectivo, descuadre y caja. Gastos, otros gastos y salida de caja se corrigen
 * en la misma tabla. La última semana del mes incluye el total del mes.
 * Cierre mensual: seguros del periodo con «Cuadrar seguros».
 */

import { routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData } from '../../core/store.js';
import { liveInsuranceEntries, insuranceCollectedOn } from '../../domain/insurance.js';
import { LEDGER_MONTHS_KEPT, addCashEntry, cashBoxAt, ledgerCutoff, cutInsurance, dayRecord, daySalary, ensureLedger, insuranceDueAt, insuranceEntries, insurancePeriod, ledgerDifference, otherExpensesNote, setDayField, setOtherExpensesNote, setWeekSalary, undoLastInsuranceCut } from '../../domain/ledger.js';
import { INSURANCE_CUT_TEST_MODE } from '../../core/config.js';
import { localDateISO } from '../../shared/dates.js';
import { formatMoney } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DATE_PICKERS = ['#report-goto-date', '#report-goto-date-monthly'];
const COLUMNS = [
  { key: 'base', label: 'Base' },
  { key: 'collections', label: 'Cobro' },
  { key: 'loans', label: 'Préstamos' },
  { key: 'expenses', label: 'Gastos', editable: true },
  { key: 'otherExpenses', label: 'Otros gastos', editable: true },
  { key: 'cashOut', label: 'Salida de caja', editable: true },
  { key: 'cashIn', label: 'Entrada a caja' },
  { key: 'cashDelivered', label: 'Efectivo' },
];
const rq = selector => document.querySelector(selector);

let selectedWeekIndex = null; // null = semana que contiene hoy (o la primera del mes)
let targetDate = null;        // fecha resaltada con «Ir a fecha»

const shortDate = date => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
const reportRouteId = () => routeSelect.value;

/** Seguros cobrados hoy que aún no entran a un cierre. */
function liveInsurance(routeId, route) {
  const today = localDateISO();
  const since = route.lastClosure?.date === today ? Date.parse(route.lastClosure.submittedAt) : 0;
  return {
    total: insuranceCollectedOn(clients, routeId, today, since).total,
    entries: liveInsuranceEntries(clients, routeId, today, since),
  };
}

// ── Selector de fecha (uno por pestaña): define el mes y la semana que se muestran ──

let reportDate = localDateISO();

function selectedMonth() {
  return reportDate.slice(0, 7);
}

function syncDatePickers() {
  DATE_PICKERS.forEach(selector => { const input = rq(selector); if (input && input.value !== reportDate) input.value = reportDate; });
}

/**
 * Semanas del mes: los días de cobro (lunes a sábado) se cortan en cada lunes. Un mes
 * queda con 4 o 5 semanas; si el corte diera 6 (p. ej. un sábado 1 y un lunes 31), el
 * tramo más corto de los extremos se une a su vecino.
 */
function calendarWeeks(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const groups = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === 0) continue; // domingo no se cobra
    if (!groups.length || date.getDay() === 1) groups.push([]);
    groups[groups.length - 1].push({ date, iso: localDateISO(date) });
  }
  while (groups.length > 5) {
    const mergeFirst = groups[0].length <= groups[groups.length - 1].length;
    if (mergeFirst) groups.splice(0, 2, [...groups[0], ...groups[1]]);
    else groups.splice(-2, 2, [...groups[groups.length - 2], ...groups[groups.length - 1]]);
  }
  return groups.map(days => ({ days, from: days[0].iso, to: days.at(-1).iso }));
}

function renderWeekTabs(weeks, activeIndex) {
  const selector = rq('#week-selector');
  selector.style.setProperty('--week-count', String(weeks.length));
  selector.replaceChildren(...weeks.map((week, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'week-tab';
    tab.dataset.week = String(index);
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(index === activeIndex));
    tab.classList.toggle('is-active', index === activeIndex);
    const title = document.createElement('span');
    title.textContent = index === weeks.length - 1 ? `Semana ${index + 1} · total mes` : `Semana ${index + 1}`;
    const range = document.createElement('small');
    range.textContent = `${shortDate(week.days[0].date)} – ${shortDate(week.days.at(-1).date)}`;
    tab.append(title, range);
    return tab;
  }));
}

export function renderRouteReports(route) {
  if (!route) return;
  ensureLedger(route);
  syncDatePickers();
  const monthValue = selectedMonth();
  document.querySelectorAll('[data-report-year]').forEach(node => { node.textContent = monthValue.slice(0, 4); });
  renderCashBox(route);
  renderWeeklyAudit(route, monthValue);
  renderMonthlyInsurance(route, monthValue);
}

// ── Caja del cobro ──

function renderCashBox(route) {
  const { opening, openingDate } = route.cashBox;
  const routeId = reportRouteId();
  const current = cashBoxAt(route, localDateISO(), liveInsurance(routeId, route).total);
  rq('#cashbox-current').textContent = current === null ? '—' : formatMoney(current);
  rq('#cashbox-current').classList.toggle('is-negative', Number(current) < 0);
  const since = openingDate ? new Date(`${openingDate}T12:00:00`).toLocaleDateString('es-CO') : '';
  rq('#cashbox-opening').textContent = !openingDate ? 'Empezó en $ 0 con el primer cierre del cobro.'
    : route.cashBox.prunedBefore === openingDate ? `Viene de ${formatMoney(opening)} el ${since} (se guardan los cierres de los últimos ${LEDGER_MONTHS_KEPT} meses).`
    : `Apertura: ${formatMoney(opening)} desde el ${since}`;
  const last = [...(route.cashEntries || [])].sort((a, b) => b.ts - a.ts)[0];
  const lastEntry = rq('#cashbox-last-entry');
  lastEntry.hidden = !last;
  if (last) lastEntry.textContent = `Última entrada: ${formatMoney(last.amount)} el ${new Date(`${last.date}T12:00:00`).toLocaleDateString('es-CO')}${last.note ? ` · ${last.note}` : ''} · ${last.by}`;
}

/** Entrada de caja: el admin inyecta capital al cobro (queda registrado con fecha y motivo). */
function openCashEntry(route) {
  if (!route) return;
  const today = localDateISO();
  openCustomModal({
    title: `Entrada de caja · ${route.name}`,
    description: 'Capital que se inyecta al cobro. Suma a la caja desde la fecha elegida y queda registrado con quién lo hizo y el motivo. No modifica los cierres.',
    fields: [
      { name: 'amount', label: 'Monto que entra a la caja ($)', type: 'number', min: 1, step: 1, value: '', required: true },
      { name: 'date', label: 'Fecha', type: 'date', value: today, min: ledgerCutoff(today), max: today, required: true },
      { name: 'note', label: 'Motivo', placeholder: 'Ej. Inyección de capital', value: '' },
    ],
    submitLabel: 'Registrar entrada',
    onSubmit: values => {
      const amount = Math.round(Number(values.amount) || 0);
      if (amount <= 0) { rq('#custom-modal-error').textContent = 'Escribe un monto mayor que cero.'; return false; }
      if (!values.date || values.date > today || values.date < ledgerCutoff(today)) { rq('#custom-modal-error').textContent = `La fecha debe estar entre el ${new Date(`${ledgerCutoff(today)}T12:00:00`).toLocaleDateString('es-CO')} y hoy.`; return false; }
      addCashEntry(route, amount, { date: values.date, by: 'Administrador', note: values.note || 'Inyección de capital' });
      persistBusinessData();
      renderRouteReports(route);
      showToast(`Entrada de ${formatMoney(amount)} registrada en la caja de ${route.name}.`);
    },
  });
}

// ── Cierre semanal ──

function moneyCell(value, { negativeClass = false } = {}) {
  const cell = document.createElement('td');
  cell.className = 'numeric';
  if (value === null || value === undefined) { cell.textContent = '—'; cell.classList.add('is-muted'); return cell; }
  cell.textContent = formatMoney(value);
  if (negativeClass && value !== 0) cell.classList.add(value < 0 ? 'is-short' : 'is-surplus');
  return cell;
}

function editableCell(dateISO, key, value, disabled) {
  const cell = document.createElement('td');
  cell.className = 'numeric editable-cell';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1000';
  input.inputMode = 'numeric';
  input.className = 'ledger-input';
  input.dataset.money = '';
  input.value = String(value || 0);
  input.dataset.date = dateISO;
  input.dataset.field = key;
  input.disabled = disabled;
  input.setAttribute('aria-label', `${COLUMNS.find(column => column.key === key).label} del ${dateISO}`);
  cell.append(input);
  return cell;
}

/** Texto completo del comentario de otros gastos de un día (lo anotado + el sueldo). */
function otherExpensesSummary(route, dateISO) {
  const salary = daySalary(route, dateISO);
  return [otherExpensesNote(route, dateISO), salary ? `Sueldo (${formatMoney(salary)})` : ''].filter(Boolean).join('\n');
}

/** Botón junto a «Otros gastos»: muestra de qué fueron y permite corregir el comentario. */
function otherExpensesNoteButton(route, dateISO, disabled) {
  const summary = otherExpensesSummary(route, dateISO);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'expense-note-button';
  button.classList.toggle('has-note', Boolean(summary));
  button.dataset.noteDate = dateISO;
  button.disabled = disabled;
  button.textContent = '💬';
  button.title = summary || 'Sin comentario: toca para agregar de qué fueron los otros gastos';
  button.setAttribute('aria-label', `Comentario de otros gastos del ${dateISO}${summary ? `: ${summary.replace(/\n/g, '; ')}` : ''}`);
  return button;
}

function openOtherExpensesNote(route, dateISO) {
  const salary = daySalary(route, dateISO);
  const day = new Date(`${dateISO}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: '2-digit' });
  openCustomModal({
    title: `Otros gastos · ${day}`,
    description: `Total del día: ${formatMoney(dayRecord(route, dateISO).otherExpenses)}.${salary ? ` Incluye el sueldo del trabajador (${formatMoney(salary)}), que se cambia en «Sueldo trabajador».` : ''}`,
    fields: [{ name: 'note', label: '¿En qué se gastó?', type: 'textarea', rows: 4, value: otherExpensesNote(route, dateISO), placeholder: 'Ej. Pinchada $ 12.000, gasolina $ 20.000' }],
    submitLabel: 'Guardar comentario',
    onSubmit: values => {
      setOtherExpensesNote(route, dateISO, values.note);
      persistBusinessData();
      renderRouteReports(route);
      showToast('Comentario de otros gastos guardado.');
    },
  });
}

/** Día al que se suma el sueldo de la semana: el sábado, o hoy si la semana va en curso. */
function salaryDate(week, today) {
  return week.to <= today ? week.to : week.from <= today ? today : null;
}

function totalsRow(label, totals, className) {
  const row = document.createElement('tr');
  row.className = className;
  const head = document.createElement('th');
  head.scope = 'row';
  head.textContent = label;
  row.append(head);
  COLUMNS.forEach(({ key }) => row.append(moneyCell(totals[key])));
  row.append(moneyCell(totals.difference, { negativeClass: true }), moneyCell(totals.cashBox));
  return row;
}

function sumDays(route, days, liveTotal) {
  const totals = Object.fromEntries(COLUMNS.map(({ key }) => [key, 0]));
  totals.difference = 0;
  days.forEach(({ iso }) => {
    const record = dayRecord(route, iso, liveTotal);
    COLUMNS.forEach(({ key }) => { totals[key] += record[key]; });
    totals.difference += ledgerDifference(record) || 0;
  });
  // La base no se suma: se muestra la del primer día del periodo.
  totals.base = days.length ? dayRecord(route, days[0].iso, liveTotal).base : 0;
  totals.cashBox = days.length ? cashBoxAt(route, days.at(-1).iso <= localDateISO() ? days.at(-1).iso : localDateISO(), liveTotal) : null;
  return totals;
}

function renderWeeklyAudit(route, monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const routeId = reportRouteId();
  const live = liveInsurance(routeId, route).total;
  const today = localDateISO();
  const weeks = calendarWeeks(monthValue);
  if (targetDate && targetDate.slice(0, 7) === monthValue) {
    // Semana que contiene la fecha (un domingo cae en la semana que terminó el sábado).
    selectedWeekIndex = weeks.reduce((found, week, index) => (targetDate >= week.from ? index : found), 0);
  }
  if (selectedWeekIndex === null || selectedWeekIndex >= weeks.length) {
    const todayIndex = weeks.reduce((found, week, index) => (today >= week.from ? index : found), -1);
    selectedWeekIndex = todayIndex >= 0 ? todayIndex : 0;
  }
  const week = weeks[selectedWeekIndex];
  const isLastWeek = selectedWeekIndex === weeks.length - 1;
  renderWeekTabs(weeks, selectedWeekIndex);

  const dayFormatter = new Intl.DateTimeFormat('es-CO', { weekday: 'long' });
  const fullDate = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  rq('#selected-week-label').textContent = `Semana ${selectedWeekIndex + 1} de ${weeks.length} · ${dayFormatter.format(week.days[0].date)} ${fullDate.format(week.days[0].date)} – ${dayFormatter.format(week.days.at(-1).date)} ${fullDate.format(week.days.at(-1).date)}${isLastWeek ? ` · incluye el total de ${MONTH_NAMES[month - 1]}` : ''}`;

  const body = rq('#weekly-audit-body');
  body.replaceChildren();
  let hasDemo = false;
  week.days.forEach(({ date, iso }) => {
    const record = dayRecord(route, iso, live);
    hasDemo ||= Boolean(record.demo);
    const future = iso > today;
    const row = document.createElement('tr');
    row.classList.toggle('is-today', iso === today);
    row.classList.toggle('is-future', future);
    row.classList.toggle('is-target', iso === targetDate);
    const dateCell = document.createElement('th');
    dateCell.scope = 'row';
    dateCell.innerHTML = `<span>${dayFormatter.format(date)}</span><small>${fullDate.format(date)}${record.live ? ' · en curso' : ''}</small>`;
    if (!future && record.cashAdjustment) {
      // Día del sistema anterior: el ajuste explica por qué la caja no es solo cobro − préstamos − gastos − salida.
      const note = document.createElement('small');
      note.className = 'cash-adjustment-note';
      note.textContent = `Ajuste de caja ${record.cashAdjustment > 0 ? '+' : '−'}${formatMoney(Math.abs(record.cashAdjustment))}`;
      note.title = record.adjustmentNote || 'Ajuste de caja del sistema anterior';
      dateCell.append(note);
    }
    row.append(dateCell);
    COLUMNS.forEach(({ key, editable }) => {
      if (!editable) { row.append(future ? moneyCell(null) : moneyCell(record[key])); return; }
      const cell = editableCell(iso, key, record[key], future);
      if (key === 'otherExpenses') { cell.classList.add('has-note-button'); cell.append(otherExpensesNoteButton(route, iso, future)); }
      row.append(cell);
    });
    row.append(moneyCell(future ? null : ledgerDifference(record), { negativeClass: true }));
    row.append(moneyCell(future ? null : cashBoxAt(route, iso, live)));
    body.append(row);
  });

  const foot = rq('#weekly-audit-foot');
  foot.replaceChildren();
  const weekTotals = sumDays(route, week.days.filter(day => day.iso <= today), live);
  foot.append(totalsRow(`Total semana ${selectedWeekIndex + 1}`, weekTotals, 'week-total-row'));
  if (isLastWeek) {
    const monthDays = weeks.flatMap(item => item.days).filter(day => day.iso <= today);
    const monthTotals = sumDays(route, monthDays, live);
    foot.append(totalsRow(`Total ${MONTH_NAMES[month - 1]} ${year}`, monthTotals, 'month-total-row'));
  }

  rq('#weekly-collections').textContent = formatMoney(weekTotals.collections);
  const difference = rq('#weekly-difference');
  difference.textContent = formatMoney(weekTotals.difference);
  difference.classList.toggle('is-short', weekTotals.difference < 0);
  difference.classList.toggle('is-surplus', weekTotals.difference > 0);
  // Sueldo del trabajador: lo escribe el admin y se suma a «otros gastos» con el comentario «Sueldo».
  const salaryInput = rq('#weekly-salary');
  const salary = route.weeklySalaries?.[week.from];
  const payDay = salary?.date || salaryDate(week, today);
  salaryInput.value = salary ? String(salary.amount) : '';
  salaryInput.dataset.week = week.from;
  salaryInput.dataset.date = payDay || '';
  salaryInput.disabled = !payDay || state.userRole !== 'admin';
  rq('#weekly-salary-hint').textContent = `${salary ? `Sumado a otros gastos del ${new Date(`${salary.date}T12:00:00`).toLocaleDateString('es-CO')} · ` : payDay ? '' : 'La semana aún no empieza · '}6 % del cobro: ${formatMoney(Math.round(weekTotals.collections * 0.06))}`;
  rq('#weekly-note').textContent = `Gastos, otros gastos y salida de caja se corrigen directamente en la tabla; con 💬 ves y corriges en qué fueron los otros gastos. El descuadre de la semana se reinicia cada sábado. Cada fecha queda guardada en el libro diario del cobro.${hasDemo ? ' Los días anteriores al primer cierre real son datos de demostración.' : ''}`;
  targetDate = null;
}

// ── Cierre mensual: seguros ──

function renderMonthlyInsurance(route, monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const routeId = reportRouteId();
  const isCurrentMonth = monthValue === localDateISO().slice(0, 7);
  const period = insurancePeriod(route, monthValue, liveInsurance(routeId, route).entries);
  rq('#monthly-period-label').textContent = MONTH_NAMES[month - 1].toLocaleUpperCase('es');
  rq('#monthly-period-year').textContent = String(year);
  // Resumen = lo que falta por cuadrar. Tras el cuadre queda en 0; la tabla conserva el detalle.
  const pendingTotal = period.lastCut ? 0 : period.total;
  rq('#monthly-insurance').textContent = formatMoney(pendingTotal);
  rq('#worker-insurance').textContent = formatMoney(Math.floor(pendingTotal / 2));
  rq('#owner-insurance').textContent = formatMoney(pendingTotal - Math.floor(pendingTotal / 2));
  rq('#insurance-summary-label').textContent = period.lastCut ? `Por cuadrar · ya se cuadraron ${formatMoney(period.cuts.reduce((sum, cut) => sum + cut.amount, 0))}` : 'Seguros por cuadrar';

  const weeks = calendarWeeks(monthValue);
  const body = rq('#monthly-insurance-body');
  body.replaceChildren();
  const addRow = (label, amount, className = '') => {
    const row = document.createElement('tr');
    if (className) row.className = className;
    const head = document.createElement('th');
    head.scope = 'row';
    head.textContent = label;
    row.append(head);
    [amount, Math.floor(amount / 2), amount - Math.floor(amount / 2)].forEach(value => row.append(moneyCell(value)));
    body.append(row);
    return row;
  };
  const cutLabel = cut => new Date(cut.ts).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit' });
  weeks.forEach((week, index) => {
    // Lo que viene del mes anterior (cobrado después de su cuadre) se suma a la primera semana.
    const inWeek = entry => (entry.date >= week.from && entry.date <= week.to) || (index === 0 && entry.date < week.from);
    const amount = period.entries.filter(inWeek).reduce((sum, entry) => sum + entry.amount, 0);
    const row = addRow(`Semana ${index + 1} · ${shortDate(week.days[0].date)} – ${shortDate(week.days.at(-1).date)}`, amount);
    // La semana en que se cuadró se marca en verde, con la fecha del cuadre en la misma fila.
    const cutsHere = period.cuts.filter(cut => weeks.reduce((found, item, i) => (localDateISO(new Date(cut.ts)) >= item.from ? i : found), 0) === index);
    if (cutsHere.length) {
      row.classList.add('is-cut-week');
      const badge = document.createElement('span');
      badge.className = 'cut-badge';
      badge.textContent = `✂ Cuadrado ${cutsHere.map(cutLabel).join(' · ')}`;
      badge.title = cutsHere.map(cut => `Cuadre del ${cutLabel(cut)}: ${formatMoney(cut.amount)}`).join('\n');
      row.querySelector('th').append(badge);
    }
  });
  const foot = rq('#monthly-insurance-foot');
  foot.replaceChildren();
  const totalRow = document.createElement('tr');
  const label = document.createElement('th');
  label.scope = 'row';
  label.textContent = 'Total del periodo';
  totalRow.append(label);
  [period.total, Math.floor(period.total / 2), period.total - Math.floor(period.total / 2)].forEach(value => totalRow.append(moneyCell(value)));
  foot.append(totalRow);

  const status = rq('#insurance-cut-status');
  const detail = rq('#insurance-cut-detail');
  const button = rq('#insurance-cut-button');
  const cutDate = cut => new Date(cut.ts).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (period.lastCut) {
    const lastDay = new Date(year, month, 0).getDate();
    const early = new Date(period.lastCut.ts).getDate() < lastDay;
    status.textContent = `✂ Cuadrado el ${cutDate(period.lastCut)}${early ? ' · antes de fin de mes' : ''}`;
    const cutList = period.cuts.map(cut => `${new Date(cut.ts).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit' })}: ${formatMoney(cut.amount)}`).join(' · ');
    detail.textContent = `${period.cuts.length > 1 ? `Cuadres del mes: ${cutList}. ` : `Cuadre: ${formatMoney(period.lastCut.amount)}.`}`;
  } else {
    status.textContent = 'Pendiente por cuadrar';
    detail.textContent = '';
  }
  const undo = rq('#insurance-undo-button');
  rq('#insurance-test-badge').hidden = !INSURANCE_CUT_TEST_MODE;
  if (INSURANCE_CUT_TEST_MODE) {
    // Modo de prueba: cualquier mes, varias veces, con fecha elegida y opción de deshacer.
    button.hidden = false;
    button.disabled = false;
    button.textContent = 'Cuadrar seguros (prueba)';
    undo.hidden = !period.cuts.length;
    return;
  }
  undo.hidden = true;
  // Solo el mes en curso se cuadra; el monto es lo acumulado desde el último cuadre.
  const pending = isCurrentMonth ? pendingInsurance(route, routeId, monthValue) : 0;
  button.hidden = !isCurrentMonth;
  button.disabled = pending <= 0;
  button.textContent = pending > 0 ? `Cuadrar seguros · ${formatMoney(pending)}` : 'Cuadrar seguros';
}

/** Seguros acumulados desde el último cuadre (o desde que empezó el periodo del mes). */
function pendingInsurance(route, routeId, monthValue) {
  const live = liveInsurance(routeId, route).entries;
  const period = insurancePeriod(route, monthValue, live);
  const since = Math.max(period.from, period.lastCut ? period.lastCut.ts : -Infinity);
  return insuranceEntries(route, live).filter(entry => entry.ts > since).reduce((sum, entry) => sum + entry.amount, 0);
}

/** Modo de prueba: cuadre con fecha y hora elegidas dentro del mes mostrado. */
function cutInsuranceTest(route) {
  const routeId = reportRouteId();
  const monthValue = selectedMonth();
  const isCurrentMonth = monthValue === localDateISO().slice(0, 7);
  const [year, month] = monthValue.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const pad = value => String(value).padStart(2, '0');
  const now = new Date();
  const defaultValue = isCurrentMonth
    ? `${localDateISO(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    : `${monthValue}-${pad(lastDay)}T20:00`;
  openCustomModal({
    title: 'Cuadrar seguros · modo de prueba',
    description: `Elige la fecha y hora del cuadre dentro de ${MONTH_NAMES[month - 1]} ${year}. Se cuadra lo cobrado desde el cuadre anterior (o desde que empezó el periodo) hasta ese momento; lo cobrado después pasa al mes siguiente.`,
    fields: [{ name: 'when', label: 'Fecha y hora del cuadre', type: 'datetime-local', value: defaultValue, required: true }],
    submitLabel: 'Cuadrar',
    onSubmit: values => {
      const ts = new Date(values.when).getTime();
      if (!Number.isFinite(ts) || values.when.slice(0, 7) !== monthValue) { rq('#custom-modal-error').textContent = `La fecha debe estar dentro de ${MONTH_NAMES[month - 1]} ${year}.`; return false; }
      if (ts > Date.now()) { rq('#custom-modal-error').textContent = 'La fecha no puede ser futura.'; return false; }
      const amount = insuranceDueAt(route, ts, liveInsurance(routeId, route).entries);
      cutInsurance(route, amount, 'Administrador (prueba)', ts);
      persistBusinessData();
      renderRouteReports(route);
      showToast(`Cuadre de prueba registrado el ${new Date(ts).toLocaleString('es-CO')}: ${formatMoney(amount)}.`);
    },
  });
}

function undoInsuranceCut(route) {
  const removed = undoLastInsuranceCut(route, selectedMonth());
  if (!removed) return;
  persistBusinessData();
  renderRouteReports(route);
  showToast(`Se deshizo el cuadre del ${new Date(removed.ts).toLocaleString('es-CO')} (${formatMoney(removed.amount)}).`);
}

function cutInsuranceNow(route) {
  if (INSURANCE_CUT_TEST_MODE) { cutInsuranceTest(route); return; }
  const routeId = reportRouteId();
  const monthValue = localDateISO().slice(0, 7);
  const amount = pendingInsurance(route, routeId, monthValue);
  if (amount <= 0) return;
  const lastDay = new Date(Number(monthValue.slice(0, 4)), Number(monthValue.slice(5)), 0).getDate();
  const early = new Date().getDate() < lastDay;
  openCustomModal({
    title: 'Cuadrar seguros',
    description: `Se cuadran ${formatMoney(amount)} de seguros del cobro ${route.name}: ${formatMoney(Math.floor(amount / 2))} para el trabajador y ${formatMoney(amount - Math.floor(amount / 2))} para el dueño. El acumulado vuelve a 0.${early ? ' Como aún no termina el mes, los seguros que se cobren desde ahora pasarán al mes siguiente.' : ''}`,
    submitLabel: 'Cuadrar seguros',
    onSubmit: () => {
      cutInsurance(route, amount);
      persistBusinessData();
      renderRouteReports(route);
      showToast(`Seguros cuadrados: ${formatMoney(amount)}.`);
    },
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  rq('#cashbox-entry').addEventListener('click', () => openCashEntry(state.activeSettlement));
  DATE_PICKERS.forEach(selector => rq(selector).addEventListener('change', event => {
    const value = event.target.value;
    if (!value) return;
    reportDate = value;
    targetDate = value;
    selectedWeekIndex = null;
    if (new Date(`${value}T12:00:00`).getDay() === 0) showToast('Los domingos no se cobra: se muestra la semana que terminó el sábado.');
    renderRouteReports(state.activeSettlement);
  }));
  rq('#week-selector').addEventListener('click', event => {
    const tab = event.target.closest('.week-tab');
    if (!tab) return;
    selectedWeekIndex = Number(tab.dataset.week);
    renderRouteReports(state.activeSettlement);
  });
  // Corrección de gastos, otros gastos y salida de caja directamente en la tabla.
  rq('#weekly-audit-body').addEventListener('change', event => {
    const input = event.target.closest('.ledger-input');
    if (!input || state.userRole !== 'admin') return;
    const route = state.activeSettlement;
    setDayField(route, input.dataset.date, input.dataset.field, input.value);
    persistBusinessData();
    // Se repinta en el siguiente ciclo: así no se quita la celda mientras aún tiene el foco.
    window.setTimeout(() => renderRouteReports(route), 0);
    const label = COLUMNS.find(column => column.key === input.dataset.field).label;
    showToast(`${label} del ${new Date(`${input.dataset.date}T12:00:00`).toLocaleDateString('es-CO')} actualizado: ${formatMoney(Number(input.value) || 0)}.`);
  });
  rq('#weekly-audit-body').addEventListener('click', event => {
    const button = event.target.closest('.expense-note-button');
    if (!button || state.userRole !== 'admin') return;
    openOtherExpensesNote(state.activeSettlement, button.dataset.noteDate);
  });
  rq('#weekly-salary').addEventListener('change', event => {
    const input = event.target;
    if (state.userRole !== 'admin' || !input.dataset.week || !input.dataset.date) return;
    const route = state.activeSettlement;
    const amount = Math.round(Number(input.value) || 0);
    const date = setWeekSalary(route, input.dataset.week, input.dataset.date, amount);
    persistBusinessData();
    window.setTimeout(() => renderRouteReports(route), 0);
    showToast(amount ? `Sueldo de ${formatMoney(amount)} sumado a otros gastos del ${new Date(`${date}T12:00:00`).toLocaleDateString('es-CO')}.` : 'Sueldo quitado de otros gastos.');
  });
  rq('#insurance-cut-button').addEventListener('click', () => cutInsuranceNow(state.activeSettlement));
  rq('#insurance-undo-button').addEventListener('click', () => undoInsuranceCut(state.activeSettlement));
  document.querySelectorAll('[data-report-tab]').forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.reportTab;
    document.querySelectorAll('[data-report-tab]').forEach(tab => {
      const active = tab === button;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-report-panel]').forEach(panel => { panel.hidden = panel.dataset.reportPanel !== selected; });
  }));
}
