/**
 * features/auth · Inicio y cierre de sesión (trabajador / administrador).
 *
 * Flujo: usuario + contraseña → verificación en dos pasos (TOTP, salvo dispositivo recordado) → app.
 * Tras varios intentos fallidos el dispositivo se bloquea unos segundos.
 *
 * Con servidor, la sesión de Supabase queda guardada en el navegador: al recargar o abrir la
 * app se restaura sin pedir nada si es válida, ya pasó la verificación en dos pasos (aal2, o
 * un dispositivo recordado) y el perfil sigue activo (acceso y horario). Se cierra sola tras
 * `security.session.idleHours` horas sin usar la app, y «Cerrar sesión» la cierra de verdad.
 */

import { localAdminPasswordHash } from '../admin/account-settings.js';
import { adminView, customModal, interestModal, loginError, loginGateway, newClientModal, paymentForm, routeSelect, gpsIndicator, workerView } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { clients, pendingRequests, persistBusinessData, personnel, routeSettlements, security } from '../../core/store.js';
import { backend, backendEnabled, backendErrorMessage, usernameToEmail } from '../../core/backend.js';
import { setAccessHook, startSync, stopSync } from '../../core/sync.js';
import { LOCKOUT_SECONDS, MAX_LOGIN_ATTEMPTS, TWO_FACTOR_REQUIRED } from '../../core/security-config.js';
import { isAccountTrusted, refreshTrustedState, trustAccount } from './device-trust.js';
import { describeSchedule, isWithinSchedule, minutesUntilClose } from '../../domain/access-schedule.js';
import { showToast } from '../../ui/toast.js';
import { cancelSecondFactor, requestSecondFactor } from './two-factor.js';
import { defaultAdminPanel, renderAdminRoute, showAdminPanel, syncRouteSelect } from '../admin/admin-shell.js';
import { renderPendingRequests } from '../admin/pending.js';
import { showVehicleExpiryAlert } from '../admin/personnel.js';
import { renderRouteOperations } from '../admin/settlement.js';
import { filterClientCards, renderClientRows } from '../clients/directory.js';
import { closeInterestModal } from '../clients/interest.js';
import { closeNewClientModal } from '../clients/new-client.js';
import { renderRouteBuilder } from '../daily-route/daily-route.js';
import { closePayment } from '../payments/payment.js';
import { renderWorkerDailyMetrics, updateCashTotal } from '../worker/cash-box.js';
import { hashCredential } from '../../shared/crypto.js';
import { routeKey } from '../../shared/format.js';
import { closeCustomModal } from '../../ui/custom-modal.js';
import { showView } from '../../ui/navigation.js';
import { restoreLastScreen } from '../../ui/back-navigation.js';
import { collapseHomePanels } from '../worker/home.js';
import { resumeWorkerLocationSharing } from '../worker/location.js';

// ── Bloqueo por intentos fallidos (por dispositivo) ──
const LOCK_KEY = 'edgecredit-login-guard';

function readGuard() {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null') || { failures: 0, lockedUntil: 0 }; }
  catch { return { failures: 0, lockedUntil: 0 }; }
}

function writeGuard(guard) {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(guard)); } catch { /* opcional */ }
}

function lockRemainingSeconds() {
  return Math.max(0, Math.ceil((readGuard().lockedUntil - Date.now()) / 1000));
}

/** Suma un intento fallido; al llegar al máximo bloquea el ingreso. */
function registerFailure() {
  const guard = readGuard();
  guard.failures += 1;
  if (guard.failures >= MAX_LOGIN_ATTEMPTS) {
    guard.failures = 0;
    guard.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
  }
  writeGuard(guard);
  return Math.max(0, MAX_LOGIN_ATTEMPTS - guard.failures);
}

function clearFailures() {
  writeGuard({ failures: 0, lockedUntil: 0 });
}

let lockTimer = null;
function showLockCountdown() {
  window.clearInterval(lockTimer);
  const submit = document.querySelector('#login-submit');
  const tick = () => {
    const seconds = lockRemainingSeconds();
    submit.disabled = seconds > 0;
    if (seconds > 0) loginError.textContent = `Demasiados intentos fallidos. Intenta de nuevo en ${seconds} s.`;
    else { window.clearInterval(lockTimer); if (loginError.textContent.startsWith('Demasiados')) loginError.textContent = ''; }
  };
  tick();
  lockTimer = window.setInterval(tick, 1000);
}

function failLogin(message) {
  const remaining = registerFailure();
  if (lockRemainingSeconds() > 0) { showLockCountdown(); return; }
  loginError.textContent = remaining <= 2 ? `${message} Te quedan ${remaining} intento(s).` : message;
}

/** Código 2FA incorrecto: cuenta como intento fallido y, si se bloquea, vuelve al primer paso. */
function failSecondFactor() {
  registerFailure();
  if (lockRemainingSeconds() > 0) cancelSecondFactor();
}

function logout() {
  if (backendEnabled()) endServerSession();
  forgetActivity();
  cancelSecondFactor();
  document.querySelector('#login-form').reset();
  document.querySelector('#login-user').value = '';
  document.querySelector('#login-password').value = '';
  paymentForm.reset();
  if (state.locationWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.locationWatchId);
  state.locationWatchId = null;
  gpsIndicator.classList.remove('is-active', 'is-searching', 'is-denied');
  gpsIndicator.querySelector('.gps-indicator-label').textContent = 'GPS';
  closePayment();
  if (!customModal.hidden) closeCustomModal();
  if (!newClientModal.hidden) closeNewClientModal();
  if (!interestModal.hidden) closeInterestModal();
  document.querySelector('#directory-search').value = '';
  document.querySelector('#home-search').value = '';
  Object.keys(clients).forEach(clientId => { if (clients[clientId]) renderClientRows(clientId); });
  persistBusinessData();
  renderPendingRequests();
  state.activeWorker = personnel[0] || { id: 'worker-unassigned', name: 'Trabajador', route: '', openingAmount: 0 };
  state.workerRoute = routeKey(state.activeWorker.route);
  state.userRole = 'worker';
  state.authenticatedWorker = null;
  state.currentView = 'inicio';
  state.previousView = 'inicio';
  state.activeClient = null;
  syncRouteSelect();
  state.activeSettlement = routeSettlements[routeSelect.value] || null;
  workerView.hidden = true;
  adminView.hidden = true;
  loginGateway.hidden = false;
  document.body.classList.add('login-active');
  document.body.classList.remove('admin-mode', 'admin-client-mode', 'admin-menu-open', 'modal-open');
  document.querySelector('[data-report-tab="weekly"]').click();
  showAdminPanel('settlement');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Vigilancia del horario y del acceso individual durante la sesión del trabajador ──
function syncAccessFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('edgecredit-business-data') || 'null');
    const match = saved?.personnel?.find(worker => worker.id === state.activeWorker?.id);
    if (match && state.activeWorker) state.activeWorker.accessEnabled = match.accessEnabled;
    if (saved?.security?.workerAccess) Object.assign(security.workerAccess, saved.security.workerAccess);
  } catch { /* datos opcionales */ }
}

let closingWarned = false;
function checkWorkerSchedule() {
  if (state.userRole !== 'worker' || workerView.hidden) { closingWarned = false; return; }
  if (state.activeWorker?.accessEnabled === false) {
    logout();
    loginError.textContent = 'Tu sesión se cerró: el administrador desactivó tu acceso.';
    return;
  }
  const schedule = security.workerAccess;
  if (!isWithinSchedule(schedule)) {
    logout();
    loginError.textContent = `Tu sesión se cerró porque terminó el horario de acceso (${describeSchedule(schedule)}).`;
    return;
  }
  const left = minutesUntilClose(schedule);
  if (left !== null && left <= 10 && !closingWarned) {
    closingWarned = true;
    showToast(`El horario de acceso termina en ${left} minuto${left === 1 ? '' : 's'}. Guarda lo que estés registrando.`);
  }
}

// ── Autenticación ──

/** Modo local (sin servidor): credenciales guardadas en este navegador. */
async function authenticateLocally() {
  const loginName = document.querySelector('#login-user').value.trim().toLocaleLowerCase('es');
  const isAdmin = loginName === 'admin';
  try {
    const submittedHash = await hashCredential(document.querySelector('#login-password').value);
    if (isAdmin) {
      if (submittedHash !== localAdminPasswordHash()) { failLogin('Usuario o contraseña de administrador incorrectos.'); return null; }
      return { isAdmin, account: { label: 'admin', record: security.admin, save: persistBusinessData, onFailure: failSecondFactor } };
    }
    const candidate = personnel.find(worker => worker.username?.toLocaleLowerCase('es') === loginName);
    if (!candidate || submittedHash !== candidate.passwordHash) { failLogin('Usuario o contraseña incorrectos.'); return null; }
    if (!workerMayEnter(candidate)) return null;
    return { isAdmin, account: { label: candidate.username, record: candidate, save: persistBusinessData, onFailure: failSecondFactor, worker: candidate } };
  } catch (error) {
    loginError.textContent = error.message || 'No se pudo validar la cuenta en este navegador.';
    return null;
  }
}

/** Acceso individual y horario: aun con credenciales válidas pueden impedir el ingreso. */
function workerMayEnter(worker) {
  if (worker.accessEnabled === false) {
    loginError.textContent = 'Tu acceso al sistema está desactivado. Comunícate con el administrador.';
    return false;
  }
  if (!isWithinSchedule(security.workerAccess)) {
    loginError.textContent = `Fuera del horario de acceso. Horario permitido: ${describeSchedule(security.workerAccess)}`;
    return false;
  }
  return true;
}

/** Modo servidor: Supabase Auth (contraseña) + MFA nativo de Supabase. */
async function authenticateWithServer() {
  const loginName = document.querySelector('#login-user').value.trim();
  let db;
  try { db = await backend(); }
  catch (error) { loginError.textContent = backendErrorMessage(error); return null; }
  const { data, error } = await db.auth.signInWithPassword({ email: usernameToEmail(loginName), password: document.querySelector('#login-password').value });
  if (error || !data?.user) {
    if (/fetch|network/i.test(String(error?.message))) loginError.textContent = backendErrorMessage(error);
    else failLogin('Usuario o contraseña incorrectos.');
    return null;
  }
  const user = data.user;
  const { data: profile, error: profileError } = await db.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (profileError || !profile) { loginError.textContent = 'No se encontró el perfil de esta cuenta. Comunícate con el administrador.'; await endServerSession(); return null; }
  if (profile.role === 'pending') { loginError.textContent = 'Tu cuenta todavía no tiene una ruta asignada. Pide al administrador que la active.'; await endServerSession(); return null; }
  const isAdmin = profile.role === 'admin';
  const { data: settings } = await db.from('app_settings').select('*').eq('key', 'worker_access').maybeSingle();
  if (settings?.data) Object.assign(security.workerAccess, settings.data);
  const worker = isAdmin ? null : serverWorker(profile);
  if (!isAdmin && !workerMayEnter(worker)) { await endServerSession(); return null; }
  // Verificación en dos pasos con el MFA de Supabase.
  const factors = await db.auth.mfa.listFactors();
  let factorId = factors.data?.totp?.find(factor => factor.status === 'verified')?.id || null;
  const remote = {
    needsEnroll: !factorId,
    async enroll() {
      const stale = (factors.data?.all || []).filter(factor => factor.status !== 'verified');
      for (const factor of stale) await db.auth.mfa.unenroll({ factorId: factor.id });
      const { data: enrolled, error: enrollError } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: `EdgeCredit ${new Date().toISOString()}`, issuer: 'EdgeCredit' });
      if (enrollError) throw enrollError;
      factorId = enrolled.id;
      return { secret: enrolled.totp.secret, uri: enrolled.totp.uri };
    },
    async verify(code) {
      const { error: verifyError } = await db.auth.mfa.challengeAndVerify({ factorId, code });
      return !verifyError;
    },
  };
  return { isAdmin, account: { label: profile.username, trustKey: user.id, record: {}, remote, worker, onFailure: failSecondFactor } };
}

/**
 * Cierra la sesión del servidor y limpia los datos de este dispositivo. Solo cierra la sesión
 * de este dispositivo (scope 'local'): el admin no pierde la sesión de sus otros equipos.
 */
async function endServerSession() {
  await stopSync();
  let signedOut = false;
  try { const db = await backend(); const { error } = await db.auth.signOut({ scope: 'local' }); signedOut = !error; } catch { /* sin conexión */ }
  // Sin conexión supabase-js conserva la sesión guardada: se borra a mano para que al
  // recargar no se vuelva a entrar sola.
  if (!signedOut) {
    try { Object.keys(localStorage).filter(key => key.startsWith('edgecredit-auth')).forEach(key => localStorage.removeItem(key)); } catch { /* opcional */ }
  }
  Object.keys(clients).forEach(key => delete clients[key]);
  pendingRequests.splice(0, pendingRequests.length);
}

// ── Cierre por inactividad ──
const ACTIVITY_KEY = 'edgecredit-last-activity';
const SESSION_SETTINGS_KEY = 'edgecredit-session-settings';

function idleLimitMs() {
  const hours = Number(security.session?.idleHours);
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 3600000;
}

function lastActivity() {
  try { return Number(localStorage.getItem(ACTIVITY_KEY)) || 0; } catch { return 0; }
}

/** Anota que la app se está usando (como mucho cada 30 s; lo comparten las pestañas). */
function markActivity(force = false) {
  if (!force && Date.now() - lastActivity() < 30000) return;
  try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch { /* opcional */ }
}

function forgetActivity() {
  try { localStorage.removeItem(ACTIVITY_KEY); } catch { /* opcional */ }
}

function idleExpired() {
  const last = lastActivity();
  return Boolean(last) && Date.now() - last > idleLimitMs();
}

const insideApp = () => loginGateway.hidden;

function idleMessage() {
  const hours = idleLimitMs() / 3600000;
  return `Tu sesión se cerró tras ${hours} hora${hours === 1 ? '' : 's'} sin usar la app. Vuelve a ingresar.`;
}

function checkIdle() {
  if (!insideApp() || !idleExpired()) return;
  logout();
  loginError.textContent = idleMessage();
}

// ── Restaurar la sesión guardada al abrir o recargar la app ──
let restoring = false;
let restoreRetryPending = false;

function setRestoring(on, message = '') {
  restoring = on;
  document.querySelector('#login-submit').disabled = on || lockRemainingSeconds() > 0;
  loginGateway.classList.toggle('is-restoring', on);
  loginError.textContent = message;
}

/** ¿La sesión guardada ya pasó la verificación en dos pasos? */
async function secondFactorDone(db, userId) {
  if (!TWO_FACTOR_REQUIRED) return true;
  const { data, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  if (data.currentLevel === 'aal2') return true;
  // Dispositivo recordado: al ingresar tampoco se pide el código, así que la sesión vale igual.
  return data.nextLevel === 'aal2' && isAccountTrusted(userId, 0);
}

/**
 * Al recargar no se ve la pantalla de ingreso: mientras se restaura la sesión guardada se
 * muestra «Cargando tu sesión…» (lo activa index.html antes de cargar la app) y al entrar
 * se vuelve a la pantalla en la que se estaba.
 */
async function restoreServerSession() {
  if (!backendEnabled() || restoring || insideApp()) { if (!backendEnabled()) document.documentElement.classList.remove('session-restoring'); return; }
  try {
    await restoreSavedSession();
  } finally {
    // Si no se pudo entrar, aparece el formulario de ingreso (con el motivo, si lo hay).
    if (!insideApp()) { restoring = false; loginGateway.classList.remove('is-restoring'); document.querySelector('#login-submit').disabled = lockRemainingSeconds() > 0; }
    document.documentElement.classList.remove('session-restoring');
  }
}

async function restoreSavedSession() {
  restoreRetryPending = false;
  try { Object.assign(security.session, JSON.parse(localStorage.getItem(SESSION_SETTINGS_KEY) || 'null') || {}); } catch { /* opcional */ }
  let db;
  try { db = await backend(); } catch { restoreRetryPending = true; return; }
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  const session = sessionData?.session;
  if (!session) {
    if (sessionError && /fetch|network/i.test(String(sessionError.message))) restoreRetryPending = true;
    return;
  }
  if (idleExpired()) {
    await endServerSession();
    forgetActivity();
    loginError.textContent = idleMessage();
    return;
  }
  setRestoring(true, 'Restaurando tu sesión…');
  try {
    const userId = session.user.id;
    if (!(await secondFactorDone(db, userId))) { await endServerSession(); setRestoring(false); return; }
    const { data: profile, error: profileError } = await db.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role === 'pending') { await endServerSession(); setRestoring(false); return; }
    const isAdmin = profile.role === 'admin';
    const { data: settings } = await db.from('app_settings').select('*').in('key', ['worker_access', 'session']);
    (settings || []).forEach(row => {
      if (row.key === 'worker_access' && row.data) Object.assign(security.workerAccess, row.data);
      if (row.key === 'session' && row.data) { Object.assign(security.session, row.data); try { localStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify(security.session)); } catch { /* opcional */ } }
    });
    const worker = isAdmin ? null : serverWorker(profile);
    if (!isAdmin && !workerMayEnter(worker)) { const message = loginError.textContent; await endServerSession(); setRestoring(false, message); return; }
    const account = { label: profile.username, trustKey: userId, record: {}, worker };
    if (!(await enterWithServer(account, isAdmin))) { setRestoring(false, loginError.textContent); return; }
    setRestoring(false);
    enterApp(account, isAdmin);
    restoreLastScreen(isAdmin);
  } catch (error) {
    // Sin conexión: la sesión se conserva y se reintenta al volver internet.
    const offline = /fetch|network/i.test(String(error?.message || error));
    if (offline) restoreRetryPending = true;
    else await endServerSession();
    setRestoring(false, offline ? 'Sin conexión: tu sesión se restaurará al volver internet.' : `No se pudo restaurar la sesión: ${backendErrorMessage(error)}`);
  }
}

function serverWorker(profile) {
  return { ...(profile.data || {}), id: profile.user_id, username: profile.username, email: profile.email, accessEnabled: profile.access_enabled !== false, route: profile.data?.route || profile.route_id || '' };
}

/** Carga los datos del servidor de una sesión ya verificada. false si no se pudo. */
async function enterWithServer(account, isAdmin) {
  loginError.textContent = 'Cargando datos del servidor…';
  try {
    if (!isAdmin) personnel.splice(0, personnel.length, account.worker);
    await startSync({ userId: account.trustKey, role: isAdmin ? 'admin' : 'worker', routeId: routeKey(account.worker?.route || ''), routeName: account.worker?.route });
    afterServerLoad();
  } catch (error) {
    loginError.textContent = `No se pudieron cargar los datos: ${backendErrorMessage(error)}`;
    await endServerSession();
    return false;
  }
  loginError.textContent = '';
  return true;
}

/** Tras cargar los datos del servidor: normaliza y repinta las listas. */
let afterServerLoad = () => {};
export function setAfterServerLoad(fn) { afterServerLoad = fn; }

/** Muestra la vista del admin o del trabajador tras un ingreso exitoso. */
function enterApp(account, isAdmin) {
    clearFailures();
    markActivity(true);
    state.authenticatedWorker = account.worker || null;
    document.querySelector('#login-password').value = '';
    loginGateway.hidden = true;
    document.body.classList.remove('login-active');
    state.userRole = isAdmin ? 'admin' : 'worker';
    workerView.hidden = isAdmin;
    adminView.hidden = !isAdmin;
    document.body.classList.toggle('admin-mode', isAdmin);
    document.body.classList.remove('admin-client-mode');
    if (isAdmin) {
      document.querySelector('#add-client').hidden = true;
      document.querySelector('#admin-add-client').hidden = true;
      document.querySelector('#nav-daily-route').hidden = true;
      document.querySelector('#nav-map').hidden = true;
      gpsIndicator.hidden = true;
      syncRouteSelect();
      renderAdminRoute(routeSelect.value);
      showAdminPanel(defaultAdminPanel());
    } else {
    document.querySelector('#add-client').hidden = false;
    document.querySelector('#admin-add-client').hidden = false; // también el trabajador crea clientes desde el directorio
    document.querySelector('#nav-daily-route').hidden = false;
    document.querySelector('#nav-map').hidden = false;
      gpsIndicator.hidden = false;
      state.activeWorker = state.authenticatedWorker
        || personnel[0] || { id: 'worker-unassigned', name: 'Trabajador', route: '', openingAmount: 0 };
      state.workerRoute = routeKey(state.activeWorker.route);
      resumeWorkerLocationSharing();
      updateCashTotal();
      document.querySelector('#nav-daily-route').hidden = false;
      document.querySelector('#home-title').textContent = `Buen día, ${state.activeWorker.name.split(/\s+/)[0]}`;
      document.querySelector('.section-heading .avatar').textContent = state.activeWorker.name.trim().split(/\s+/).map(part => part[0]).slice(0, 1).join('').toUpperCase();
      document.querySelector('#home-title').closest('.section-heading').querySelector('.eyebrow').textContent = `RUTA ${state.activeWorker.route.toLocaleUpperCase('es')}`;
      renderWorkerDailyMetrics();
      showView('inicio');
      filterClientCards();
      renderRouteOperations(routeSettlements[state.workerRoute]);
      renderRouteBuilder();
      collapseHomePanels();
      showVehicleExpiryAlert(state.activeWorker);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    loginError.textContent = '';
    if (lockRemainingSeconds() > 0) { showLockCountdown(); return; }
    const submit = document.querySelector('#login-submit');
    submit.disabled = true;
    try {
      const result = backendEnabled() ? await authenticateWithServer() : await authenticateLocally();
      if (!result) return;
      const { account, isAdmin } = result;
      // Segundo paso: código de la app de autenticación (o configuración en el primer ingreso).
      // En un dispositivo recordado (ya verificado y vigente) no se vuelve a pedir.
      const trusted = account.remote
        ? !account.remote.needsEnroll && isAccountTrusted(account.trustKey, 0)
        : Boolean(account.record.totpSecret) && isAccountTrusted(account.label, account.record.trustVersion);
      if (TWO_FACTOR_REQUIRED && !trusted) {
        const verified = await requestSecondFactor(account);
        if (!verified) {
          document.querySelector('#login-password').value = '';
          if (account.remote) await endServerSession();
          if (lockRemainingSeconds() > 0) showLockCountdown();
          document.querySelector('#login-password').focus();
          return;
        }
        if (document.querySelector('#two-factor-remember').checked) trustAccount(account.trustKey || account.label, account.remote ? 0 : account.record.trustVersion);
        refreshTrustedState();
      }
      // El horario o el acceso pudieron cambiar mientras se escribía el código.
      if (!isAdmin && account.worker?.accessEnabled === false) {
        loginError.textContent = 'Tu acceso al sistema está desactivado. Comunícate con el administrador.';
        if (account.remote) await endServerSession();
        return;
      }
      if (!isAdmin && !isWithinSchedule(security.workerAccess)) {
        loginError.textContent = `Fuera del horario de acceso. Horario permitido: ${describeSchedule(security.workerAccess)}`;
        if (account.remote) await endServerSession();
        return;
      }
      if (account.remote && !(await enterWithServer(account, isAdmin))) return;
      enterApp(account, isAdmin);
    } finally {
      submit.disabled = false;
    }
  });
  document.querySelectorAll('#worker-logout, #admin-logout').forEach(button => button.addEventListener('click', logout));
  // Modo servidor: si el admin cambia el acceso del trabajador, se aplica al instante.
  // Sin perfil (cambió el horario): solo se vuelve a revisar el horario.
  setAccessHook(profile => {
    if (state.userRole !== 'worker' || !state.activeWorker) return;
    if (profile) state.activeWorker.accessEnabled = profile.access_enabled !== false;
    checkWorkerSchedule();
  });
  // Sin servidor no hay usuarios iniciales que mostrar en otro dispositivo.
  if (backendEnabled()) document.querySelector('.login-demo-hint').hidden = true;
  if (lockRemainingSeconds() > 0) showLockCountdown();
  window.setInterval(checkWorkerSchedule, 30000);
  // Si el admin bloquea al trabajador desde otra pestaña del mismo navegador, se aplica al instante.
  window.addEventListener('storage', event => { if (event.key === 'edgecredit-business-data') { syncAccessFromStorage(); checkWorkerSchedule(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkIdle(); checkWorkerSchedule(); } });
  // Inactividad: cualquier toque, tecla o desplazamiento cuenta como uso.
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(type => document.addEventListener(type, () => { if (insideApp()) markActivity(); }, { passive: true, capture: true }));
  window.setInterval(checkIdle, 60000);
  window.addEventListener('online', () => { if (restoreRetryPending) restoreServerSession(); });
  restoreServerSession();
}
