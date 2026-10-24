/**
 * ui/money-input · Campos de dinero con separador de miles (4.000.000).
 *
 * Los campos marcados con `data-money` se muestran con puntos mientras se escribe,
 * pero el resto del código sigue leyendo un número limpio:
 *  - `input.value` devuelve solo los dígitos ("4000000").
 *  - `new FormData(form)` también recibe los dígitos (evento `formdata`).
 * Los campos que se crean después (modales, tablas) se preparan solos.
 *
 * Con `data-money-thousands` (abonos, gastos y seguros que escribe el trabajador en la
 * calle) un número menor que 1.000 se entiende en miles: 20 → 20.000, «20,5» o «20.5» →
 * 20.500. Debajo del campo se ve el valor real («= $ 20.000») y `value` devuelve ese valor.
 */

import { formatMoney } from '../shared/format.js';

const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
/** Dígitos del texto, conservando el signo menos si va al inicio (p. ej. una base negativa). */
const onlyDigits = text => {
  const value = String(text ?? '').trim();
  const digits = value.replace(/\D/g, '');
  return digits && value.startsWith('-') ? `-${digits}` : digits;
};
const withDots = digits => (digits && digits !== '-' ? Number(digits).toLocaleString('es-CO', { maximumFractionDigits: 0 }) : digits);

/**
 * Monto escrito «en miles» → pesos (o null si no hay número).
 * «20» → 20000 · «20,5» / «20.5» → 20500 · «1.500» / «1500» → 1500 · «1.000.000» → 1000000.
 * Con un solo separador y hasta 3 cifras después, «20.500» da 20.500 leído de las dos
 * formas (20,5 mil o 20 mil 500), así que no hay ambigüedad con los puntos de miles.
 */
export function parseThousandsAmount(text) {
  const raw = String(text ?? '').replace(/[\s$]/g, '');
  if (!raw) return null;
  const decimal = raw.match(/^(\d{1,3})[.,](\d{1,3})$/);
  if (decimal) return Math.round(Number(`${decimal[1]}.${decimal[2]}`) * 1000);
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const amount = Number(digits);
  return amount < 1000 ? amount * 1000 : amount;
}

function applyMinValidity(input) {
  const min = input.dataset.moneyMin;
  const digits = input.dataset.moneyThousands !== undefined ? String(parseThousandsAmount(nativeValue.get.call(input)) ?? '') : onlyDigits(nativeValue.get.call(input));
  const tooLow = min !== undefined && min !== '' && digits !== '' && Number(digits) < Number(min);
  input.setCustomValidity(tooLow ? `El valor debe ser de al menos ${withDots(String(min))}.` : '');
}

/** Valor real debajo del campo en miles. Va después del recuadro del campo si lo tiene. */
function thousandsHint(input) {
  if (input._moneyHint) return input._moneyHint;
  const hint = document.createElement('small');
  hint.className = 'money-thousands-hint';
  hint.id = `${input.id || `money-${Math.random().toString(36).slice(2, 8)}`}-hint`;
  hint.setAttribute('aria-live', 'polite');
  (input.closest('.amount-input-wrap') || input).after(hint);
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), hint.id].filter(Boolean).join(' '));
  input._moneyHint = hint;
  return hint;
}

function updateThousandsHint(input) {
  const amount = parseThousandsAmount(nativeValue.get.call(input));
  const hint = thousandsHint(input);
  hint.textContent = amount === null ? 'En miles: 20 = $ 20.000 · 20,5 = $ 20.500' : `= ${formatMoney(amount)}`;
  hint.classList.toggle('has-amount', amount !== null);
}

/** Campo en miles: se escribe libre (cifras y una coma o punto) y se lee en pesos. */
function enhanceThousandsInput(input) {
  const current = onlyDigits(nativeValue.get.call(input).split(/[.,](?=\d{1,2}$)/)[0]);
  if (input.min !== '' && input.dataset.moneyMin === undefined) input.dataset.moneyMin = input.min;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.removeAttribute('min');
  input.removeAttribute('step');
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { const amount = parseThousandsAmount(nativeValue.get.call(this)); return amount === null ? '' : String(amount); },
    set(value) {
      // El código asigna pesos (p. ej. el seguro general): se muestran con puntos, que se leen igual.
      nativeValue.set.call(this, withDots(onlyDigits(String(value ?? '').split(/[.,](?=\d{1,2}$)/)[0])));
      updateThousandsHint(this);
      applyMinValidity(this);
    },
  });
  nativeValue.set.call(input, withDots(current));
  updateThousandsHint(input);
  input.addEventListener('input', () => {
    const text = nativeValue.get.call(input);
    const clean = text.replace(/[^\d.,]/g, '');
    if (clean !== text) nativeValue.set.call(input, clean);
    updateThousandsHint(input);
    applyMinValidity(input);
  });
}

/** Convierte un input numérico en campo de dinero con puntos. */
export function enhanceMoneyInput(input) {
  if (!(input instanceof HTMLInputElement) || input.dataset.moneyReady) return;
  input.dataset.moneyReady = '1';
  if (input.dataset.moneyThousands !== undefined) { enhanceThousandsInput(input); return; }
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
