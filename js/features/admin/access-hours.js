/**
 * features/admin/access-hours · Tarjeta «Horario de acceso de trabajadores»
 * (Gestión de Personal). Guarda la regla en security.workerAccess.
 */

import { state } from '../../core/state.js';
import { persistBusinessData, security } from '../../core/store.js';
import { describeSchedule, isWithinSchedule } from '../../domain/access-schedule.js';
import { showToast } from '../../ui/toast.js';

const ah = selector => document.querySelector(selector);

function setBodyEnabled(enabled) {
  ah('#access-schedule-body').classList.toggle('is-disabled', !enabled);
  ah('#access-schedule-body').querySelectorAll('input').forEach(input => { input.disabled = !enabled; });
}

function readForm() {
  return {
    enabled: ah('#access-enabled').checked,
    days: [...document.querySelectorAll('input[name="accessDay"]:checked')].map(input => Number(input.value)),
    start: ah('#access-start').value,
    end: ah('#access-end').value,
  };
}

function renderSummary(schedule, saved = true) {
  ah('#access-schedule-summary').textContent = describeSchedule(schedule);
  const status = ah('#access-status');
  if (!saved) { status.textContent = 'Cambios sin guardar'; status.dataset.tone = 'pending'; return; }
  if (!schedule.enabled) { status.textContent = ''; status.dataset.tone = ''; return; }
  const open = isWithinSchedule(schedule);
  status.textContent = open ? '● Ahora mismo los trabajadores pueden ingresar' : '● Ahora mismo el ingreso está cerrado';
  status.dataset.tone = open ? 'open' : 'closed';
}

export function renderAccessSchedule() {
  const schedule = security.workerAccess;
  ah('#access-enabled').checked = Boolean(schedule.enabled);
  document.querySelectorAll('input[name="accessDay"]').forEach(input => { input.checked = (schedule.days || []).includes(Number(input.value)); });
  ah('#access-start').value = schedule.start || '06:00';
  ah('#access-end').value = schedule.end || '20:00';
  setBodyEnabled(schedule.enabled);
  renderSummary(schedule);
}

export function mount() {
  const form = ah('#access-schedule-form');
  form.addEventListener('input', () => {
    setBodyEnabled(ah('#access-enabled').checked);
    renderSummary(readForm(), false);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (state.userRole !== 'admin') return;
    const next = readForm();
    if (next.enabled) {
      if (!next.days.length) { ah('#access-status').textContent = 'Elige al menos un día.'; ah('#access-status').dataset.tone = 'closed'; return; }
      if (!next.start || !next.end || next.start === next.end) { ah('#access-status').textContent = 'La hora de inicio y la de fin deben ser distintas.'; ah('#access-status').dataset.tone = 'closed'; return; }
    }
    Object.assign(security.workerAccess, next);
    persistBusinessData();
    renderAccessSchedule();
    showToast(next.enabled ? `Horario de acceso guardado: ${describeSchedule(next)}.` : 'Restricción de horario desactivada.');
  });
  renderAccessSchedule();
}
