/**
 * domain/access-schedule · Horario en el que los trabajadores pueden usar el sistema.
 *
 * El administrador define los días y la franja horaria en «Gestión de Personal».
 * Fuera de ese horario un trabajador no puede ingresar aunque tenga usuario,
 * contraseña y código de verificación, y la sesión abierta se cierra sola al terminar.
 * El administrador no tiene restricción de horario.
 *
 * Sin backend la hora sale del reloj del dispositivo; cuando exista el servidor, esta
 * misma regla debe validarse allí con la hora del servidor.
 */

export const DAY_LABELS = [
  { value: 1, short: 'L', name: 'lunes' },
  { value: 2, short: 'M', name: 'martes' },
  { value: 3, short: 'X', name: 'miércoles' },
  { value: 4, short: 'J', name: 'jueves' },
  { value: 5, short: 'V', name: 'viernes' },
  { value: 6, short: 'S', name: 'sábado' },
  { value: 0, short: 'D', name: 'domingo' },
];

export const DEFAULT_ACCESS_SCHEDULE = { enabled: false, days: [1, 2, 3, 4, 5, 6], start: '06:00', end: '20:00' };

function minutes(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** ¿Está permitido el ingreso en este momento? Soporta franjas que cruzan la medianoche. */
export function isWithinSchedule(schedule, now = new Date()) {
  if (!schedule?.enabled) return true;
  const start = minutes(schedule.start);
  const end = minutes(schedule.end);
  if (start === null || end === null || start === end) return true;
  const current = now.getHours() * 60 + now.getMinutes();
  const days = schedule.days || [];
  if (start < end) return days.includes(now.getDay()) && current >= start && current < end;
  // Franja nocturna (ej. 22:00 → 02:00): la parte de madrugada pertenece al día anterior.
  if (current >= start) return days.includes(now.getDay());
  if (current < end) return days.includes((now.getDay() + 6) % 7);
  return false;
}

/** Minutos que faltan para que termine la franja actual (null si no aplica). */
export function minutesUntilClose(schedule, now = new Date()) {
  if (!schedule?.enabled || !isWithinSchedule(schedule, now)) return null;
  const end = minutes(schedule.end);
  const current = now.getHours() * 60 + now.getMinutes();
  return (end - current + 1440) % 1440 || 1440;
}

export function formatTime12(hhmm) {
  const total = minutes(hhmm);
  if (total === null) return '—';
  const h = Math.floor(total / 60), m = total % 60;
  const suffix = h < 12 ? 'a. m.' : 'p. m.';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Resumen legible: «lunes a sábado, 6:00 a. m. – 8:00 p. m.». */
export function describeSchedule(schedule) {
  if (!schedule?.enabled) return 'Sin restricción: los trabajadores pueden ingresar a cualquier hora.';
  const ordered = DAY_LABELS.filter(day => (schedule.days || []).includes(day.value));
  let days;
  if (!ordered.length) days = 'ningún día';
  else if (ordered.length === 7) days = 'todos los días';
  else {
    const idx = ordered.map(day => DAY_LABELS.indexOf(day));
    const consecutive = idx.every((value, i) => i === 0 || value === idx[i - 1] + 1);
    days = consecutive && ordered.length > 2 ? `${ordered[0].name} a ${ordered.at(-1).name}` : ordered.map(day => day.name).join(', ');
  }
  return `${days.charAt(0).toUpperCase()}${days.slice(1)}, ${formatTime12(schedule.start)} – ${formatTime12(schedule.end)}`;
}
