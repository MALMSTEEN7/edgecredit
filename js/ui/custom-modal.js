/**
 * ui/custom-modal · Modal genérico de formulario/confirmación reutilizado por todos los módulos.
 * Contrato: openCustomModal({ title, description, fields, submitLabel, onSubmit, cancelLabel, onCancel }).
 * cancelLabel/onCancel permiten usar el botón secundario como acción (p. ej. «No recordar más»);
 * si onCancel devuelve false, el modal sigue abierto.
 * onSubmit puede ser async; si devuelve false, el modal queda abierto.
 *
 * Además de los campos normales:
 *  - `type: 'note'`: recuadro informativo (`label`, `value`, `hint`, `className`), como el
 *    «Interés predeterminado» al crear un préstamo. `valueId`/`hintId` permiten cambiarlo en vivo.
 *  - `type: 'checkbox'`: casilla (p. ej. «Usar un interés diferente al general»).
 *  - `showWhen: '<nombre de casilla>'`: el campo solo se ve (y se envía) con esa casilla marcada.
 *  - `onInput(form)`: se llama al escribir o marcar algo (para actualizar las notas).
 */

import { customModal, customModalError, customModalFields, customModalForm, interestModal, modal, newClientModal } from '../core/dom.js';
import { state } from '../core/state.js';

export function openCustomModal({ title, description = '', fields = [], submitLabel = 'Guardar', onSubmit, cancelLabel = 'Cancelar', onCancel = null, onInput = null }) {
  state.lastFocusedElement = document.activeElement;
  document.querySelector('#custom-modal-title').textContent = title;
  document.querySelector('#custom-modal-description').textContent = description;
  document.querySelector('#custom-modal-save').textContent = submitLabel;
  document.querySelector('#custom-modal-cancel').textContent = cancelLabel;
  state.customModalCancel = onCancel;
  customModalError.textContent = '';
  customModalFields.replaceChildren();
  state.customModalSubmit = onSubmit;
  fields.forEach((field, index) => {
    if (field.type === 'note') {
      const note = document.createElement('div');
      note.className = field.className || 'default-rate-note';
      const label = document.createElement('span');
      label.textContent = field.label;
      const value = document.createElement('strong');
      value.textContent = field.value ?? '';
      if (field.valueId) value.id = field.valueId;
      note.append(label, value);
      if (field.hint) {
        const hint = document.createElement('small');
        hint.textContent = field.hint;
        if (field.hintId) hint.id = field.hintId;
        note.append(hint);
      }
      if (field.showWhen) { note.dataset.showWhen = field.showWhen; note.hidden = true; }
      customModalFields.append(note);
      return;
    }
    if (field.type === 'checkbox') {
      const toggle = document.createElement('label');
      toggle.className = 'exception-toggle';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.id = `custom-field-${index}`;
      box.name = field.name;
      box.checked = Boolean(field.value);
      const text = document.createElement('span');
      text.textContent = field.label;
      toggle.append(box, text);
      customModalFields.append(toggle);
      return;
    }
    const wrapper = document.createElement('label');
    wrapper.className = 'custom-field';
    wrapper.htmlFor = `custom-field-${index}`;
    wrapper.append(document.createTextNode(field.label));
    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      field.options.forEach(option => {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        input.append(element);
      });
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = field.rows || 3;
      if (field.placeholder) input.placeholder = field.placeholder;
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
      if (field.minLength !== undefined) input.minLength = Number(field.minLength);
      if (field.placeholder) input.placeholder = field.placeholder;
    }
    // Campos de dinero ($): se muestran con separador de miles (ui/money-input.js).
    if (field.money || (field.type === 'number' && /\(\$\)/.test(field.label))) input.dataset.money = '';
    // `thousands: true`: el monto se escribe en miles (200 = $ 200.000), como los abonos.
    if (field.thousands) { input.dataset.money = ''; input.dataset.moneyThousands = ''; }
    input.id = `custom-field-${index}`;
    input.name = field.name;
    input.value = field.value ?? '';
    input.required = Boolean(field.required);
    wrapper.append(input);
    if (field.showWhen) { wrapper.dataset.showWhen = field.showWhen; wrapper.classList.add('custom-field-dependent'); }
    customModalFields.append(wrapper);
  });
  // Campos que dependen de una casilla: ocultos y deshabilitados (no se envían) hasta marcarla.
  const syncDependents = () => customModalFields.querySelectorAll('[data-show-when]').forEach(node => {
    const box = customModalFields.querySelector(`input[type="checkbox"][name="${node.dataset.showWhen}"]`);
    node.hidden = !box?.checked;
    node.querySelectorAll('input,select,textarea').forEach(control => { control.disabled = node.hidden; });
  });
  syncDependents();
  customModalFields.oninput = customModalFields.onchange = () => { syncDependents(); onInput?.(customModalForm); };
  onInput?.(customModalForm);
  customModal.hidden = false;
  customModal.classList.add('active');
  document.body.classList.add('modal-open');
  window.setTimeout(() => customModalFields.querySelector('input:not([type="checkbox"]),select')?.focus(), 20);
}

export function closeCustomModal() {
  customModal.hidden = true;
  customModal.classList.remove('active');
  state.customModalSubmit = null;
  if (interestModal.hidden && modal.hidden && newClientModal.hidden) document.body.classList.remove('modal-open');
  if (state.lastFocusedElement instanceof HTMLElement) state.lastFocusedElement.focus();
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  customModalForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!customModalForm.reportValidity()) return;
    const values = Object.fromEntries(new FormData(customModalForm).entries());
    const saveButton = document.querySelector('#custom-modal-save');
    saveButton.disabled = true;
    try {
      const result = await state.customModalSubmit?.(values);
      if (result !== false) closeCustomModal();
    } catch (error) {
      customModalError.textContent = error.message || 'No se pudo completar la operación.';
    } finally {
      saveButton.disabled = false;
    }
  });
  document.querySelector('#custom-modal-close').addEventListener('click', closeCustomModal);
  document.querySelector('#custom-modal-cancel').addEventListener('click', () => {
    const onCancel = state.customModalCancel;
    state.customModalCancel = null;
    // onCancel puede devolver false para dejar el modal abierto (p. ej. «Copiar»).
    if (onCancel?.() === false) { state.customModalCancel = onCancel; return; }
    closeCustomModal();
  });
  customModal.addEventListener('click', event => { if (event.target === customModal) closeCustomModal(); });
}
