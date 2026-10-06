/**
 * ui/money-input · Campos de dinero con separador de miles (4.000.000).
 *
 * Los campos marcados con `data-money` se muestran con puntos mientras se escribe,
 * pero el resto del código sigue leyendo un número limpio:
 *  - `input.value` devuelve solo los dígitos ("4000000").
 *  - `new FormData(form)` también recibe los dígitos (evento `formdata`).
 * Los campos que se crean después (modales, tablas) se preparan solos.
 */

const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
/** Dígitos del texto, conservando el signo menos si va al inicio (p. ej. una base negativa). */
const onlyDigits = text => {
  const value = String(text ?? '').trim();
  const digits = value.replace(/\D/g, '');
  return digits && value.startsWith('-') ? `-${digits}` : digits;
};
const withDots = digits => (digits && digits !== '-' ? Number(digits).toLocaleString('es-CO', { maximumFractionDigits: 0 }) : digits);

function applyMinValidity(input) {
  const min = input.dataset.moneyMin;
  const digits = onlyDigits(nativeValue.get.call(input));
  const tooLow = min !== undefined && min !== '' && digits !== '' && Number(digits) < Number(min);
  input.setCustomValidity(tooLow ? `El valor debe ser de al menos ${withDots(String(min))}.` : '');
}

/** Convierte un input numérico en campo de dinero con puntos. */
export function enhanceMoneyInput(input) {
  if (!(input instanceof HTMLInputElement) || input.dataset.moneyReady) return;
  input.dataset.moneyReady = '1';
  const current = onlyDigits(nativeValue.get.call(input).split(/[.,](?=\d{1,2}$)/)[0]);
  if (input.min !== '' && input.dataset.moneyMin === undefined) input.dataset.moneyMin = input.min;
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.removeAttribute('min');
  input.removeAttribute('step');
  if (input.placeholder) input.placeholder = input.placeholder.replace(/\d{4,}/g, match => withDots(match));
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { return onlyDigits(nativeValue.get.call(this)); },
    set(value) {
      const raw = String(value ?? '').split(/[.,](?=\d{1,2}$)/)[0]; // ignora decimales "1250000.5"
      nativeValue.set.call(this, withDots(onlyDigits(raw)));
      applyMinValidity(this);
    },
  });
  nativeValue.set.call(input, withDots(current));
  input.addEventListener('input', () => {
    const text = nativeValue.get.call(input);
    const caret = input.selectionStart ?? text.length;
    const digitsBefore = onlyDigits(text.slice(0, caret)).length;
    const formatted = withDots(onlyDigits(text));
    nativeValue.set.call(input, formatted);
    // Deja el cursor después del mismo número de dígitos que tenía antes de formatear.
    let position = 0;
    for (let seen = 0; position < formatted.length && seen < digitsBefore; position += 1) if (/\d/.test(formatted[position])) seen += 1;
    try { input.setSelectionRange(position, position); } catch { /* algunos tipos no admiten selección */ }
    applyMinValidity(input);
  });
}

function enhanceWithin(root) {
  if (root instanceof HTMLInputElement && root.matches('[data-money]')) enhanceMoneyInput(root);
  root.querySelectorAll?.('input[data-money]').forEach(enhanceMoneyInput);
}

export function mount() {
  enhanceWithin(document);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) enhanceWithin(node); })))
    .observe(document.body, { childList: true, subtree: true });
  // FormData lee el valor interno (con puntos): se reemplaza por los dígitos.
  document.addEventListener('formdata', event => {
    event.target.querySelectorAll('input[data-money][name]').forEach(input => event.formData.set(input.name, input.value));
  }, true);
}
