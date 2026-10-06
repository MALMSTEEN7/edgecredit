/**
 * features/auth/two-factor · Segundo paso del inicio de sesión (TOTP).
 *
 * - Primer ingreso de una cuenta: genera la clave, muestra el QR para la app de
 *   autenticación, pide un código para confirmar y entrega 6 códigos de respaldo.
 * - Ingresos siguientes: pide el código de 6 dígitos (o un código de respaldo).
 *
 * `requestSecondFactor(account)` devuelve una promesa que se resuelve en true al
 * verificar y en false si la persona vuelve atrás.
 * account = { label, record, save }  · record guarda totpSecret, recoveryHashes,
 * totpLastStep y enrolledAt; save() persiste los cambios.
 */

import { TWO_FACTOR_ISSUER } from '../../core/security-config.js';
import { hashCredential } from '../../shared/crypto.js';
import { formatSecret, generateRecoveryCodes, totpForStep, generateTotpSecret, normalizeRecoveryCode, otpauthUri, verifyTotp } from '../../shared/totp.js';
import { createQRCode } from '../../vendor/qrcode.js';

const tf = selector => document.querySelector(selector);

let session = null; // { account, secret, enrolling, useRecovery, resolve }

function qrSvg(text) {
  const qr = createQRCode(text, 'M');
  const count = qr.getModuleCount();
  const margin = 4;
  const size = count + margin * 2;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

function setError(text) {
  tf('#two-factor-error').textContent = text;
}

function setRecoveryMode(on) {
  session.useRecovery = on;
  const input = tf('#two-factor-code');
  input.value = '';
  input.inputMode = on ? 'text' : 'numeric';
  input.placeholder = on ? 'XXXX-XXXX' : '000000';
  input.autocomplete = on ? 'off' : 'one-time-code';
  tf('#two-factor-code-label').textContent = on ? 'Código de respaldo' : 'Código de verificación';
  tf('#two-factor-recovery-toggle').textContent = on ? 'Usar el código de la app' : '¿Perdiste el celular? Usar un código de respaldo';
  setError('');
  input.focus();
}

function showStep(step) {
  tf('#login-form').hidden = step !== 'password';
  tf('#two-factor-form').hidden = step !== 'code';
  tf('#two-factor-recovery').hidden = step !== 'recovery';
}

/**
 * Con servidor (account.remote): la clave la genera y la verifica Supabase Auth (MFA
 * nativo); la app solo muestra el QR y envía el código. Sin servidor: TOTP local.
 */
export async function requestSecondFactor(account) {
  let remoteEnrollment = null;
  if (account.remote?.needsEnroll) remoteEnrollment = await account.remote.enroll();
  return new Promise(resolve => {
    const enrolling = account.remote ? Boolean(account.remote.needsEnroll) : !account.record.totpSecret;
    const secret = remoteEnrollment?.secret || (enrolling ? generateTotpSecret() : account.record.totpSecret);
    session = { account, secret, enrolling, useRecovery: false, resolve, uri: remoteEnrollment?.uri };
    tf('#two-factor-title').textContent = enrolling ? 'Activa la verificación en dos pasos' : 'Ingresa tu código';
    tf('#two-factor-copy').textContent = enrolling
      ? `Protege la cuenta «${account.label}»: además de la contraseña se pedirá un código que cambia cada 30 segundos.`
      : `Abre tu app de autenticación y escribe el código de 6 dígitos de «${TWO_FACTOR_ISSUER} · ${account.label}».`;
    tf('#two-factor-enroll').hidden = !enrolling;
    tf('#two-factor-recovery-toggle').hidden = enrolling || Boolean(account.remote) || !(account.record.recoveryHashes || []).length;
    if (enrolling) {
      const uri = session.uri || otpauthUri(session.secret, account.label, TWO_FACTOR_ISSUER);
      tf('#two-factor-qr').innerHTML = qrSvg(uri);
      tf('#two-factor-secret').textContent = formatSecret(session.secret);
      tf('#two-factor-open-app').href = uri;
    }
    showStep('code');
    setRecoveryMode(false);
  });
}

function finish(ok) {
  const current = session;
  session = null;
  tf('#two-factor-code').value = '';
  tf('#two-factor-qr').replaceChildren();
  tf('#recovery-codes').replaceChildren();
  showStep('password');
  current?.resolve(ok);
}

/** Cierra el flujo sin verificar (cierre de sesión, recarga de la vista, etc.). */
export function cancelSecondFactor() {
  if (session) finish(false);
}

async function submitCode(event) {
  event.preventDefault();
  if (!session) return;
  const { account, secret, enrolling } = session;
  const value = tf('#two-factor-code').value;
  const button = tf('#two-factor-submit');
  setError('');
  button.disabled = true;
  try {
    if (account.remote) {
      const digits = value.replace(/\D/g, '');
      if (digits.length !== 6) { setError('Escribe los 6 dígitos que muestra la app.'); return; }
      const ok = await account.remote.verify(digits);
      if (!ok) {
        setError('Código incorrecto o vencido. Revisa que la hora del celular sea automática.');
        if (!enrolling) account.onFailure?.();
        return;
      }
      finish(true);
      return;
    }
    if (session.useRecovery) {
      const code = normalizeRecoveryCode(value);
      if (!code) { setError('El código de respaldo tiene 8 caracteres (XXXX-XXXX).'); return; }
      const hash = await hashCredential(code);
      const hashes = account.record.recoveryHashes || [];
      if (!hashes.includes(hash)) { setError('Código de respaldo incorrecto o ya utilizado.'); account.onFailure?.(); return; }
      account.record.recoveryHashes = hashes.filter(item => item !== hash);
      account.save();
      finish(true);
      return;
    }
    const step = await verifyTotp(secret, value, { lastUsedStep: enrolling ? -1 : Number(account.record.totpLastStep ?? -1) });
    if (step === null) {
      const digits = value.replace(/\D/g, '');
      const lastStep = Number(account.record.totpLastStep ?? -1);
      const reused = !enrolling && digits.length === 6 && lastStep >= 0 && await totpForStep(secret, lastStep) === digits;
      setError(reused ? 'Ese código ya se usó. Espera a que la app muestre uno nuevo (cambia cada 30 segundos).'
        : digits.length === 6 ? 'Código incorrecto o vencido. Revisa que la hora del celular sea automática.' : 'Escribe los 6 dígitos que muestra la app.');
      if (!enrolling) account.onFailure?.();
      return;
    }
    account.record.totpLastStep = step;
    if (enrolling) {
      const codes = generateRecoveryCodes();
      account.record.totpSecret = secret;
      account.record.enrolledAt = new Date().toISOString();
      account.record.recoveryHashes = await Promise.all(codes.map(code => hashCredential(code)));
      account.save();
      showRecoveryCodes(codes);
      return;
    }
    account.save();
    finish(true);
  } catch (error) {
    setError(error.message || 'No se pudo verificar el código.');
  } finally {
    button.disabled = false;
  }
}

function showRecoveryCodes(codes) {
  const list = tf('#recovery-codes');
  list.replaceChildren(...codes.map(code => Object.assign(document.createElement('li'), { textContent: code })));
  tf('#recovery-copy').textContent = 'Copiar códigos';
  showStep('recovery');
  tf('#recovery-continue').focus();
}

async function copyText(text, button, done) {
  try { await navigator.clipboard.writeText(text); button.textContent = done; }
  catch { button.textContent = 'Cópialos a mano'; }
}

export function mount() {
  tf('#two-factor-form').addEventListener('submit', submitCode);
  tf('#two-factor-cancel').addEventListener('click', () => finish(false));
  tf('#two-factor-recovery-toggle').addEventListener('click', () => session && setRecoveryMode(!session.useRecovery));
  tf('#two-factor-code').addEventListener('input', event => {
    if (session?.useRecovery) return;
    const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== event.target.value) event.target.value = digits;
  });
  tf('#two-factor-copy-secret').addEventListener('click', event => session && copyText(session.secret, event.currentTarget, 'Copiada'));
  tf('#recovery-copy').addEventListener('click', event => copyText([...tf('#recovery-codes').children].map(item => item.textContent).join('\n'), event.currentTarget, 'Copiados'));
  tf('#recovery-continue').addEventListener('click', () => finish(true));
}
