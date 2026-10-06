/**
 * features/auth/device-trust · «Recordar este dispositivo».
 *
 * Guarda en este navegador qué cuentas ya pasaron la verificación en dos pasos y hasta
 * cuándo. Mientras esté vigente no se pide el código de verificación.
 * Si el admin restablece la verificación de un trabajador (trustVersion cambia), la
 * confianza de ese trabajador deja de valer en todos los dispositivos.
 */

import { TRUSTED_DEVICE_DAYS } from '../../core/security-config.js';

const TRUST_KEY = 'edgecredit-trusted-device';

function readTrust() {
  try { return JSON.parse(localStorage.getItem(TRUST_KEY) || 'null') || { accounts: {} }; }
  catch { return { accounts: {} }; }
}

function writeTrust(data) {
  try { localStorage.setItem(TRUST_KEY, JSON.stringify(data)); } catch { /* almacenamiento opcional */ }
}

/** ¿La cuenta ya verificó su código en este dispositivo y sigue vigente? */
export function isAccountTrusted(label, version = 0) {
  const entry = readTrust().accounts[label];
  return Boolean(entry && entry.expires > Date.now() && Number(entry.version || 0) === Number(version || 0));
}

/** ¿Este navegador está recordado para alguna cuenta? */
export function isBrowserTrusted() {
  return Object.values(readTrust().accounts).some(entry => entry.expires > Date.now());
}

export function trustAccount(label, version = 0) {
  const data = readTrust();
  data.accounts[label] = { expires: Date.now() + TRUSTED_DEVICE_DAYS * 86400000, version: Number(version || 0), since: new Date().toISOString() };
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
