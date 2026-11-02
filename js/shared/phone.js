/**
 * shared/phone · Teléfono del cliente: formato para leerlo y enlace para llamar.
 *
 * Un enlace `tel:` abre el marcador del celular con el número listo (funciona en la web app
 * igual que en una app instalada). En un computador abre la aplicación de llamadas que tenga.
 */

/** Solo dígitos (conserva un «+» inicial de código de país). Vacío si no hay número. */
export function phoneDigits(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return '';
  return raw.startsWith('+') ? `+${digits}` : digits;
}

/** «3112223344» → «311 222 3344» (otros largos se dejan como vienen). */
export function formatPhone(phone) {
  const digits = phoneDigits(phone);
  if (!digits) return String(phone || '').trim();
  return /^\d{10}$/.test(digits) ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : digits;
}

const PHONE_ICON_PATH = 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z';

/** Ícono de teléfono (SVG) para los botones de llamar. */
export function phoneIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('phone-icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', PHONE_ICON_PATH);
  svg.append(path);
  return svg;
}

/**
 * Enlace para llamar al cliente (o null si no tiene un número válido).
 * `label`: texto visible (por defecto, el número con formato).
 */
export function phoneLink(phone, { className = 'phone-link', label, name = '' } = {}) {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  const link = document.createElement('a');
  link.className = className;
  link.href = `tel:${digits}`;
  link.setAttribute('aria-label', `Llamar${name ? ` a ${name}` : ''} al ${formatPhone(phone)}`);
  link.append(phoneIcon(), Object.assign(document.createElement('span'), { textContent: label ?? formatPhone(phone) }));
  // Dentro de tarjetas que abren la ficha al tocarlas: llamar no abre la ficha.
  link.addEventListener('click', event => event.stopPropagation());
  return link;
}
