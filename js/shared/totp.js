/**
 * shared/totp · Códigos de un solo uso basados en tiempo (TOTP, RFC 6238) para la
 * verificación en dos pasos. Compatible con Google Authenticator, Microsoft
 * Authenticator, Authy, etc. (HMAC-SHA1, 6 dígitos, periodo de 30 s).
 * Usa Web Crypto: requiere contexto seguro (HTTPS, localhost o archivo local).
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_PERIOD = 30;
const DIGITS = 6;

export function base32Encode(bytes) {
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { output += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const output = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Clave de autenticación inválida.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(output);
}

function requireSubtle() {
  if (!globalThis.crypto?.subtle) throw new Error('La verificación en dos pasos requiere HTTPS o localhost.');
  return crypto.subtle;
}

/** Clave secreta aleatoria de 160 bits en Base32. */
export function generateTotpSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

/** Código para un paso de tiempo concreto (contador de 30 s). */
export async function totpForStep(secret, step) {
  const subtle = requireSubtle();
  const key = await subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = new ArrayBuffer(8);
  const view = new DataView(counter);
  view.setUint32(0, Math.floor(step / 2 ** 32));
  view.setUint32(4, step >>> 0);
  const mac = new Uint8Array(await subtle.sign('HMAC', key, counter));
  const offset = mac[mac.length - 1] & 15;
  const binary = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / TOTP_PERIOD);
}

/**
 * Verifica un código aceptando ±1 periodo de desfase del reloj del teléfono.
 * Devuelve el paso que coincidió (para impedir reutilizar el mismo código) o null.
 */
export async function verifyTotp(secret, code, { lastUsedStep = -1, now = Date.now() } = {}) {
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== DIGITS || !secret) return null;
  const step = currentStep(now);
  for (const candidate of [step, step - 1, step + 1]) {
    if (candidate <= lastUsedStep) continue;
    if (await totpForStep(secret, candidate) === clean) return candidate;
  }
  return null;
}

/** URI estándar para registrar la cuenta en la app (se codifica en el QR). */
export function otpauthUri(secret, account, issuer = 'EdgeCredit') {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${TOTP_PERIOD}`;
}

/** Agrupa la clave en bloques de 4 para dictarla o copiarla a mano. */
export function formatSecret(secret) {
  return String(secret).replace(/(.{4})/g, '$1 ').trim();
}

/** Códigos de respaldo de un solo uso (formato XXXX-XXXX). */
export function generateRecoveryCodes(count = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: count }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const raw = [...bytes].map(byte => alphabet[byte % alphabet.length]).join('');
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export function normalizeRecoveryCode(code) {
  const raw = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : '';
}
