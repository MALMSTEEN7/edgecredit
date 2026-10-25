/**
 * ui/money-input · Campos de dinero con separador de miles (4.000.000).
 *
 * Los campos marcados con `data-money` se muestran con puntos mientras se escribe,
 * pero el resto del código sigue leyendo un número limpio:
 *  - `input.value` devuelve solo los dígitos ("4000000").
 *  - `new FormData(form)` también recibe los dígitos (evento `formdata`).
 * Los campos que se crean después (modales, tablas) se preparan solos.
 *
 * Con `data-money-thousands` (abonos, préstamos, gastos, seguros y base del trabajador; en el
 * admin la liquidación diaria, peticiones y abonos) TODO lo que se escribe está en miles:
 * 20 → 20.000, «20,5» o «20.5» → 20.500, 1.000 → 1.000.000, 10.000 → 10.000.000. Debajo del
 * campo se ve el valor real («= $ 20.000») y `value` devuelve ese valor en pesos.
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
 * Monto escrito en miles → pesos (o null si no hay número).
 * La coma siempre es decimal; el punto es decimal solo si lo siguen 1 o 2 cifras al final
 * («20.5»); si no, separa miles («1.000»). Se admiten hasta 3 decimales (= pesos exactos).
 *   «20» → 20.000 · «20,5» / «20.5» → 20.500 · «1.000» → 1.000.000 · «10.000» → 10.000.000
 *   «1.000,5» → 1.000.500 · «0,75» → 750
 */
export function parseThousandsAmount(text) {
  const trimmed = String(text ?? '').replace(/[\s$]/g, '');
  const negative = trimmed.startsWith('-'); // una base negativa que llega del código («-225»)
  const raw = negative ? trimmed.slice(1) : trimmed;
  let whole = raw;
  let fraction = '';
  const comma = raw.lastIndexOf(',');
  if (comma >= 0) { whole = raw.slice(0, comma); fraction = raw.slice(comma + 1); }
  else {
    const dotDecimal = raw.match(/^(.*)\.(\d{1,2})$/);
    if (dotDecimal) [, whole, fraction] = dotDecimal;
  }
  const wholeDigits = whole.replace(/\D/g, '');
  const fractionDigits = fraction.replace(/\D/g, '').slice(0, 3);
  if (!wholeDigits && !fractionDigits) return null;
  const amount = Number(wholeDigits || 0) * 1000 + Math.round(Number(`0.${fractionDigits || 0}`) * 1000);
  return negative ? -amount : amount;
}

/** Pesos → como se escriben en miles: 20000 → «20», 20500 → «20,5», 1000000 → «1.000». */
function thousandsText(pesos) {
  const amount = Math.round(Number(pesos));
  if (!Number.isFinite(amount) || String(pesos ?? '').trim() === '') return '';
  const whole = withDots(String(Math.trunc(amount / 1000)));
  const rest = Math.abs(amount % 1000);
  return rest ? `${whole},${String(rest).padStart(3, '0').replace(/0+$/, '')}` : whole;
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
  hint.textContent = amount === null ? 'En miles: 20 = $ 20.000 · 20,5 = $ 20.500 · 1.000 = $ 1.000.000' : `= ${formatMoney(amount)}`;
  hint.classList.toggle('has-amount', amount !== null);
}

/**
 * Texto del campo en miles con la convención colombiana: puntos de miles y coma decimal
 * (hasta 3 decimales). «10000» → «10.000», «20,5» → «20,5».
 */
function thousandsDisplay(text) {
  const [whole, ...rest] = text.replace(/[^\d,]/g, '').split(',');
  const wholeDigits = whole.replace(/^0+(?=\d)/, '');
  if (!rest.length) return withDots(wholeDigits);
  return `${withDots(wholeDigits) || '0'},${rest.join('').slice(0, 3)}`;
}

/**
 * Campo en miles: se escribe en miles y se lee en pesos.
 *  - Si solo se escriben cifras, la app pone los puntos de miles («10000» → «10.000») y los
 *    rehace al borrar («10.000» ⌫ → «1.000»).
 *  - Un punto que escribe el trabajador se respeta y se lee con la regla de
 *    parseThousandsAmount: «20.5» = 20,5 mil y «1.000» = mil (mil miles).
 *  - La coma siempre es decimal.
 *  - Un monto pegado con «$» ya está en pesos y se toma tal cual.
 */
function enhanceThousandsInput(input) {
  const current = nativeValue.get.call(input);
  if (input.min !== '' && input.dataset.moneyMin === undefined) input.dataset.moneyMin = input.min;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.removeAttribute('min');
  input.removeAttribute('step');
  input._typedDot = false; // ¿el trabajador escribió un punto? (si no, los puntos son de la app)
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { const amount = parseThousandsAmount(nativeValue.get.call(this)); return amount === null ? '' : String(amount); },
    set(value) {
      // El código asigna pesos (p. ej. el seguro general): se muestran en miles (50000 → «50»).
      this._typedDot = false;
      nativeValue.set.call(this, thousandsText(value));
      updateThousandsHint(this);
      applyMinValidity(this);
    },
  });
  nativeValue.set.call(input, current ? thousandsText(onlyDigits(current)) : '');
  updateThousandsHint(input);
  input.addEventListener('input', event => {
    const text = nativeValue.get.call(input);
    const caret = input.selectionStart ?? text.length;
    let display;
    let position;
    if (['insertFromPaste', 'insertFromDrop', 'insertReplacementText'].includes(event.inputType)) {
      const pesos = text.includes('$') ? Number(onlyDigits(text.split(/,(?=\d{1,2}$)/)[0])) : parseThousandsAmount(text);
      input._typedDot = false;
      display = pesos === null || !Number.isFinite(pesos) || text.trim() === '' ? '' : thousandsText(pesos);
      position = display.length;
    } else {
      if (event.data === '.') input._typedDot = true;
      let clean = text.replace(/[^\d.,]/g, '');
      const firstComma = clean.indexOf(',');
      if (firstComma >= 0) clean = clean.slice(0, firstComma + 1) + clean.slice(firstComma + 1).replace(/,/g, '');
      if (!clean.includes('.')) input._typedDot = false;
      display = input._typedDot ? clean : thousandsDisplay(clean);
      const digitsBefore = onlyDigits(text.slice(0, caret)).length;
      const afterComma = text.slice(0, caret).includes(',');
      position = 0;
      for (let seen = 0; position < display.length && seen < digitsBefore; position += 1) if (/\d/.test(display[position])) seen += 1;
      const comma = display.indexOf(',');
      if (afterComma && comma >= 0 && position <= comma) position = comma + 1;
      if (event.data === '.' && input._typedDot) position = caret;
    }
    if (display !== text) {
      nativeValue.set.call(input, display);
      try { input.setSelectionRange(position, position); } catch { /* algunos tipos no admiten selección */ }
    }
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
    event.target.querySelectorAll('input[data-money][name]:not(:disabled)').forEach(input => event.formData.set(input.name, input.value));
  }, true);
}
