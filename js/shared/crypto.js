/**
 * shared/crypto · Hash SHA-256 de credenciales (requiere contexto seguro: HTTPS o localhost).
 */

export async function hashCredential(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador requiere HTTPS o localhost para proteger las credenciales.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
