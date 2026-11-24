/**
 * features/auth/device-trust · «Recordar este dispositivo».
 *
 * Guarda en este navegador qué cuentas ya pasaron la verificación en dos pasos. Es
 * permanente: no se vuelve a pedir el código de verificación en este navegador.
 * Si el admin restablece la verificación de un trabajador (trustVersion cambia), la
 * confianza de ese trabajador deja de valer en todos los dispositivos.
 */

const TRUST_KEY = 'edgecredit-trusted-device';

function readTrust() {
  try { return JSON.parse(localStorage.getItem(TRUST_KEY) || 'null') || { accounts: {} }; }
  catch { return { accounts: {} }; }
}

function writeTrust(data) {
  try { localStorage.setItem(TRUST_KEY, JSON.stringify(data)); } catch { /* almacenamiento opcional */ }
}

/**
 * ¿La cuenta ya verificó su código en este dispositivo? No vence: solo deja de valer si el
 * administrador restablece la verificación (cambia `version`: en el servidor es el id del
 * código activo, que es nuevo tras restablecer y volver a activarlo).
 * `createdAt`: cuándo se creó el código activo. Los dispositivos recordados antes de guardar
 * el id del código siguen valiendo si se recordaron después de crearlo (y quedan con el id).
 */
export function isAccountTrusted(label, version = 0, { createdAt } = {}) {
  const data = readTrust();
  const entry = data.accounts[label];
  if (!entry) return false;
  if (String(entry.version ?? 0) === String(version ?? 0)) return true;
  const legacy = !entry.version && entry.since && createdAt && Date.parse(entry.since) >= Date.parse(createdAt) - 10 * 60000; // margen por la hora del celular
  if (!legacy) return false;
  entry.version = version;
  writeTrust(data);
  return true;
}

/** ¿Este navegador está recordado para alguna cuenta? */
export function isBrowserTrusted() {
  return Object.keys(readTrust().accounts).length > 0;
}

export function trustAccount(label, version = 0) {
  const data = readTrust();
  data.accounts[label] = { version: typeof version === 'string' ? version : Number(version || 0), since: new Date().toISOString() };
  writeTrust(data);
}

/** Olvida este dispositivo para todas las cuentas. */
export function forgetDevice() {
  writeTrust({ accounts: {} });
}

/** Muestra en la pantalla de ingreso si este dispositivo está recordado. */
export function refreshTrustedState() {
  const note = document.querySelector('#trusted-device-note');
  if (note) note.hidden = !isBrowserTrusted();
}

export function mount() {
  document.querySelector('#forget-device').addEventListener('click', () => { forgetDevice(); refreshTrustedState(); });
  refreshTrustedState();
}
