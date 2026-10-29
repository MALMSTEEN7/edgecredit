/**
 * features/admin/route-picker · Selector de cobros del admin con indicadores visuales.
 *
 * El <select id="route-select"> sigue siendo la fuente de verdad (el resto de la app lee y
 * cambia `routeSelect.value` y escucha su evento `change`), pero queda oculto: en su lugar se
 * muestra este menú, que permite lo que un <select> nativo no deja dibujar:
 *  - un punto azul neón (con brillo) en los cobros con solicitudes pendientes por revisar;
 *  - el estado del cierre de hoy: ✓ cuadrado y enviado, ⚠ cambió después del cierre.
 * Cada opción del <select> trae esos datos en `data-status` y `data-pending` (settlement.js).
 */

import { routeSelect } from '../../core/dom.js';

const pickerButton = () => document.querySelector('#route-picker-button');
const pickerList = () => document.querySelector('#route-picker-list');

function pendingLabel(count) {
  return `${count} solicitud${count === 1 ? '' : 'es'} pendiente${count === 1 ? '' : 's'} por revisar`;
}

/** Contenido de una fila (botón o lista): estado del cierre, nombre y punto neón si hay pendientes. */
function pickerContent(option) {
  const fragment = document.createDocumentFragment();
  const status = option.dataset.status || '';
  if (status) {
    const mark = document.createElement('span');
    mark.className = `route-picker-status is-${status}`;
    mark.textContent = status === 'closed' ? '✓' : '⚠';
    mark.title = status === 'closed' ? 'Cuadrado y enviado hoy' : 'Cambió después del cierre';
    fragment.append(mark);
  }
  const name = document.createElement('span');
  name.className = 'route-picker-name';
  name.textContent = option.dataset.name || option.textContent;
  fragment.append(name);
  const pending = Number(option.dataset.pending) || 0;
  if (pending) {
    const dot = document.createElement('span');
    dot.className = 'neon-dot';
    dot.title = pendingLabel(pending);
    fragment.append(dot);
  }
  return fragment;
}

/** Vuelve a dibujar el menú a partir de las opciones del <select> (se llama con cada cambio). */
export function renderRoutePicker() {
  const picker = document.querySelector('#route-picker');
  const button = pickerButton();
  const list = pickerList();
  if (!picker || !button || !list) return;
  picker.hidden = routeSelect.hidden;
  button.disabled = routeSelect.disabled;
  const options = [...routeSelect.options];
  const current = options.find(option => option.value === routeSelect.value) || options[0];
  const label = button.querySelector('.route-picker-current');
  label.replaceChildren(...(current ? [pickerContent(current)] : []));
  const pendingTotal = options.reduce((sum, option) => sum + (Number(option.dataset.pending) || 0), 0);
  const otherPending = options.some(option => option !== current && Number(option.dataset.pending) > 0);
  // Si otro cobro tiene pendientes, el botón lo avisa también (sin abrir el menú).
  button.classList.toggle('has-other-pending', otherPending);
  button.setAttribute('aria-label', `Cobro: ${current?.dataset.name || current?.textContent || 'ninguno'}${current?.dataset.pending > 0 ? ` (${pendingLabel(Number(current.dataset.pending))})` : ''}${otherPending ? '. Hay otros cobros con solicitudes pendientes' : ''}`);
  button.title = pendingTotal ? `${pendingTotal} solicitud${pendingTotal === 1 ? '' : 'es'} pendiente${pendingTotal === 1 ? '' : 's'} en total` : '';
  list.replaceChildren(...options.map(option => {
    const item = document.createElement('li');
    item.role = 'option';
    item.tabIndex = -1;
    item.dataset.value = option.value;
    item.className = 'route-picker-option';
    const selected = option === current;
    item.classList.toggle('is-selected', selected);
    item.setAttribute('aria-selected', String(selected));
    const pending = Number(option.dataset.pending) || 0;
    item.setAttribute('aria-label', `${option.dataset.name || option.textContent}${pending ? `, ${pendingLabel(pending)}` : ''}`);
    item.append(pickerContent(option));
    return item;
  }));
}

function setOpen(open) {
  const button = pickerButton();
  const list = pickerList();
  if (!button || !list) return;
  if (open) renderRoutePicker();
  list.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  document.querySelector('#route-picker')?.classList.toggle('is-open', open);
  if (open) (list.querySelector('.is-selected') || list.firstElementChild)?.focus();
}

function choose(value) {
  setOpen(false);
  pickerButton()?.focus();
  if (!value || value === routeSelect.value) return;
  routeSelect.value = value;
  routeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  renderRoutePicker();
}

function moveFocus(step) {
  const items = [...pickerList().children];
  const index = items.indexOf(document.activeElement);
  items[(index + step + items.length) % items.length]?.focus();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  const button = pickerButton();
  const list = pickerList();
  if (!button || !list) return;
  button.addEventListener('click', () => setOpen(list.hidden));
  button.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); }
  });
  list.addEventListener('click', event => choose(event.target.closest('[data-value]')?.dataset.value));
  list.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(-1); }
    else if (event.key === 'Home') { event.preventDefault(); list.firstElementChild?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); list.lastElementChild?.focus(); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(document.activeElement?.dataset.value); }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); button.focus(); }
    else if (event.key === 'Tab') setOpen(false);
  });
  // Tocar fuera cierra el menú.
  document.addEventListener('pointerdown', event => {
    if (!list.hidden && !event.target.closest('#route-picker')) setOpen(false);
  });
  // Cambios hechos desde otras partes de la app (p. ej. al abrir un cliente de otra ruta).
  routeSelect.addEventListener('change', renderRoutePicker);
  renderRoutePicker();
}
