/**
 * features/admin/account-settings · Configuración del administrador: tema claro/oscuro,
 * cambio de contraseña y clave de recuperación. También atiende «¿Olvidaste tu
 * contraseña?» en la pantalla de ingreso.
 *
 * Con servidor (Supabase) todo pasa por funciones de supabase/cuenta.sql: la contraseña
 * y la clave se comparan cifradas en la base de datos y nunca viajan de vuelta.
 * Sin servidor (modo local) se guardan cifradas en `security.admin` de este navegador.
 */

import { adminPasswordHash } from '../../core/config.js';
import { customModalError } from '../../core/dom.js';
import { backend, backendEnabled, backendErrorMessage, usernameToEmail } from '../../core/backend.js';
import { persistBusinessData, security } from '../../core/store.js';
import { hashCredential } from '../../shared/crypto.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { applyTheme } from '../../ui/theme.js';
import { showToast } from '../../ui/toast.js';

const MIN_PASSWORD = 8;

/** Normaliza la clave: solo letras/números en mayúscula (acepta guiones, espacios o minúsculas). */
function cleanRecoveryKey(value) {
  return String(value || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
}

function prettyKey(raw) {
  return raw.match(/.{1,6}/g).join('-');
}

function randomRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function rpc(name, params) {
  const db = await backend();
  const { data, error } = await db.rpc(name, params);
  if (error) throw new Error(backendErrorMessage(error));
  return data;
}

/** Contraseña local vigente del admin (la cambiada en Configuración o la inicial). */
export function localAdminPasswordHash() {
  return security.admin.passwordHash || adminPasswordHash;
}

function validateNewPassword(values) {
  if (String(values.newPassword || '').length < MIN_PASSWORD) return `La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (values.newPassword !== values.confirmPassword) return 'La confirmación no coincide con la nueva contraseña.';
  return '';
}

// ── Pantalla de Configuración ──

export async function renderAccountSettings() {
  const light = document.documentElement.dataset.theme === 'light';
  const toggle = document.querySelector('#admin-theme-toggle');
  if (toggle) toggle.checked = light;
  const description = document.querySelector('#admin-theme-description');
  if (description) description.textContent = light ? 'Apariencia clara' : 'Apariencia oscura';
  const idle = document.querySelector('#admin-idle-hours');
  if (idle && document.activeElement !== idle) idle.value = String(Number(security.session?.idleHours) || 12);
  const status = document.querySelector('#admin-recovery-status');
  const button = document.querySelector('#admin-recovery-key');
  if (!status || !button) return;
  let createdAt = null;
  try {
    createdAt = backendEnabled() ? await rpc('my_recovery_key_date', {}) : security.admin.recoveryKeyCreatedAt || null;
  } catch { /* sin conexión: se muestra el texto general */ }
  if (createdAt) {
    const date = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(createdAt));
    status.textContent = `Clave activa, creada el ${date}. Si la pierdes, genera una nueva: la anterior deja de servir.`;
    button.textContent = 'Generar otra';
  } else {
    status.textContent = 'Aún no tienes una. Sirve para entrar si olvidas la contraseña o pierdes el celular del autenticador.';
    button.textContent = 'Generar';
  }
}

function openChangePassword() {
  openCustomModal({
    title: 'Cambiar contraseña',
    description: 'Escribe tu contraseña actual y la nueva (mínimo 8 caracteres).',
    submitLabel: 'Cambiar contraseña',
    fields: [
      { name: 'currentPassword', label: 'Contraseña actual', type: 'password', required: true },
      { name: 'newPassword', label: 'Nueva contraseña', type: 'password', minLength: MIN_PASSWORD, required: true },
      { name: 'confirmPassword', label: 'Repite la nueva contraseña', type: 'password', minLength: MIN_PASSWORD, required: true },
    ],
    onSubmit: async values => {
      const problem = validateNewPassword(values);
      if (problem) { customModalError.textContent = problem; return false; }
      try {
        if (backendEnabled()) {
          await rpc('change_my_password', { current_password: values.currentPassword, new_password: values.newPassword });
        } else {
          if (await hashCredential(values.currentPassword) !== localAdminPasswordHash()) throw new Error('La contraseña actual no es correcta.');
          security.admin.passwordHash = await hashCredential(values.newPassword);
          persistBusinessData();
        }
      } catch (error) { customModalError.textContent = error.message; return false; }
      showToast('Contraseña cambiada. Úsala desde tu próximo ingreso.');
    },
  });
}

function showRecoveryKey(key) {
  openCustomModal({
    title: 'Tu clave de recuperación',
    description: 'Guárdala fuera del celular (anotada en papel o en un lugar seguro). Solo se muestra esta vez. Con ella y tu usuario puedes poner una contraseña nueva desde «¿Olvidaste tu contraseña?»; al usarla se quita el autenticador y lo vuelves a registrar.',
    submitLabel: 'Ya la guardé',
    cancelLabel: 'Copiar',
    fields: [{ name: 'recoveryKey', label: 'Clave de recuperación', value: key }],
    onCancel: () => {
      navigator.clipboard?.writeText(key).then(() => showToast('Clave copiada.'), () => showToast('Selecciónala y cópiala manualmente.'));
      return false;
    },
    onSubmit: () => { renderAccountSettings(); },
  });
}

function openRecoveryKey() {
  openCustomModal({
    title: 'Generar clave de recuperación',
    description: 'Confirma tu contraseña actual. Si ya tenías una clave, la anterior deja de funcionar.',
    submitLabel: 'Generar clave',
    fields: [{ name: 'currentPassword', label: 'Contraseña actual', type: 'password', required: true }],
    onSubmit: async values => {
      let key;
      try {
        if (backendEnabled()) {
          key = await rpc('create_my_recovery_key', { current_password: values.currentPassword });
        } else {
          if (await hashCredential(values.currentPassword) !== localAdminPasswordHash()) throw new Error('La contraseña actual no es correcta.');
          const raw = randomRecoveryKey();
          security.admin.recoveryKeyHash = await hashCredential(raw);
          security.admin.recoveryKeyCreatedAt = new Date().toISOString();
          persistBusinessData();
          key = prettyKey(raw);
        }
      } catch (error) { customModalError.textContent = error.message; return false; }
      window.setTimeout(() => showRecoveryKey(key), 30);
    },
  });
}

// ── «¿Olvidaste tu contraseña?» (pantalla de ingreso) ──

function openForgotPassword() {
  openCustomModal({
    title: 'Recuperar acceso',
    description: 'Usa la clave de recuperación que generaste en Configuración. Si eres trabajador, pide al administrador una contraseña nueva (Gestión de Personal → Credenciales).',
    submitLabel: 'Cambiar contraseña',
    fields: [
      { name: 'username', label: 'Usuario', value: document.querySelector('#login-user')?.value || '', required: true },
      { name: 'recoveryKey', label: 'Clave de recuperación', placeholder: 'XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX', required: true },
      { name: 'newPassword', label: 'Nueva contraseña', type: 'password', minLength: MIN_PASSWORD, required: true },
      { name: 'confirmPassword', label: 'Repite la nueva contraseña', type: 'password', minLength: MIN_PASSWORD, required: true },
    ],
    onSubmit: async values => {
      const problem = validateNewPassword(values);
      if (problem) { customModalError.textContent = problem; return false; }
      const key = cleanRecoveryKey(values.recoveryKey);
      try {
        if (backendEnabled()) {
          await rpc('recover_password', { login_email: usernameToEmail(values.username), recovery_key: key, new_password: values.newPassword });
        } else {
          const isAdmin = String(values.username).trim().toLocaleLowerCase('es') === 'admin';
          if (!isAdmin || !security.admin.recoveryKeyHash || await hashCredential(key) !== security.admin.recoveryKeyHash) throw new Error('Usuario o clave de recuperación incorrectos.');
          security.admin.passwordHash = await hashCredential(values.newPassword);
          security.admin.totpSecret = null;
          security.admin.recoveryHashes = [];
          security.admin.enrolledAt = null;
          security.admin.recoveryKeyHash = null;
          security.admin.recoveryKeyCreatedAt = null;
          persistBusinessData();
        }
      } catch (error) {
        customModalError.textContent = /incorrect/i.test(error.message) ? 'Usuario o clave de recuperación incorrectos.' : error.message;
        return false;
      }
      const passwordInput = document.querySelector('#login-password');
      if (passwordInput) passwordInput.value = '';
      const userInput = document.querySelector('#login-user');
      if (userInput) userInput.value = values.username.trim();
      showToast('Listo: entra con tu nueva contraseña y vuelve a registrar el autenticador. Genera una clave de recuperación nueva en Configuración.');
    },
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#admin-theme-toggle')?.addEventListener('change', event => {
    applyTheme(event.target.checked ? 'light' : 'dark');
    renderAccountSettings();
  });
  document.querySelector('#admin-change-password')?.addEventListener('click', openChangePassword);
  // Horas sin usar la app antes de cerrar la sesión: se guarda en el servidor para todos.
  document.querySelector('#admin-idle-hours')?.addEventListener('change', event => {
    const hours = Number(event.target.value);
    if (!Number.isFinite(hours) || hours <= 0) return;
    security.session.idleHours = hours;
    try { localStorage.setItem('edgecredit-session-settings', JSON.stringify(security.session)); } catch { /* opcional */ }
    persistBusinessData();
    showToast(`Las sesiones se cerrarán tras ${hours} hora${hours === 1 ? '' : 's'} sin usar la app.`);
  });
  document.querySelector('#admin-recovery-key')?.addEventListener('click', openRecoveryKey);
  document.querySelector('#login-forgot')?.addEventListener('click', openForgotPassword);
}
