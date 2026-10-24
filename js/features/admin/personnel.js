/**
 * features/admin/personnel · Gestión de personal: CRUD, credenciales, vencimientos
 * vehiculares y ubicación.
 */

import { customModalError, personnelList, routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { departmentOptions, findDepartment } from '../../core/geo-colombia.js';
import { ensureRoute, persistBusinessData, personnel, pruneOrphanRoutes, routeSettlements } from '../../core/store.js';
import { renderAdminRoute, syncRouteSelect } from './admin-shell.js';
import { fetchWorkerLocation } from '../worker/location.js';
import { hashCredential } from '../../shared/crypto.js';
import { daysUntil } from '../../shared/dates.js';
import { addCashEntry } from '../../domain/ledger.js';
import { escapeHTML, formatMoney, routeKey } from '../../shared/format.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { geocodeMunicipality } from '../../shared/geo.js';
import { showToast } from '../../ui/toast.js';
import { AUTH_EMAIL_DOMAIN } from '../../core/backend-config.js';
import { backend, backendEnabled, backendErrorMessage } from '../../core/backend.js';

/** Tras crear, editar o eliminar personal: quita rutas sin trabajador ni clientes y repinta. */
function refreshRoutesAfterStaffChange() {
  pruneOrphanRoutes();
  syncRouteSelect();
  if (routeSettlements[routeSelect.value]) renderAdminRoute(routeSelect.value);
}

/** Llama una función de administración del servidor (supabase/schema.sql). */
async function adminRpc(name, params) {
  const db = await backend();
  const { error } = await db.rpc(name, params);
  if (error) throw new Error(backendErrorMessage(error));
}

/**
 * Ubica el municipio del trabajador y lo guarda como zona del cobro, para que el
 * mapa abra directamente ahí. Si no se encuentra, el mapa usa el departamento.
 */
function syncRouteZone(worker) {
  const route = routeSettlements[routeKey(worker.route)];
  if (!route || !worker.city) return;
  geocodeMunicipality(worker.city, worker.department).then(zone => {
    if (zone) {
      route.mapZone = { ...zone, source: 'municipio' };
      showToast(`Mapa del cobro ${route.name} centrado en ${worker.city}.`);
    } else {
      if (route.mapZone?.source !== 'manual') delete route.mapZone;
      showToast(`No se encontró "${worker.city}" en el mapa. Ábrelo y usa "Fijar esta vista como zona del cobro".`);
    }
    persistBusinessData();
  });
}

export function renderPersonnel() {
  personnelList.replaceChildren();
  if (!personnel.length) {
    const empty = document.createElement('p');
    empty.className = 'pending-empty';
    empty.textContent = 'No hay trabajadores registrados.';
    personnelList.append(empty);
    return;
  }
  personnel.forEach((worker, index) => {
    const blocked = worker.accessEnabled === false;
    const card = document.createElement('article');
    card.className = `personnel-card${blocked ? ' is-blocked' : ''}`;

    // Encabezado: avatar, nombre, ruta y el interruptor de acceso individual.
    const head = document.createElement('header');
    head.className = 'personnel-head';
    const avatar = document.createElement('span');
    avatar.className = 'admin-avatar';
    avatar.textContent = worker.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const title = document.createElement('div');
    title.className = 'personnel-title';
    title.innerHTML = `<strong>${escapeHTML(worker.name)}</strong><span class="personnel-route-chip">Ruta ${escapeHTML(worker.route)}</span>`;
    const access = document.createElement('label');
    access.className = 'access-switch personnel-access';
    access.title = blocked ? 'Acceso desactivado: no puede ingresar' : 'Acceso activo: desactívalo para bloquear su ingreso de inmediato';
    access.innerHTML = `<input type="checkbox" data-personnel-access="${index}" ${blocked ? '' : 'checked'} aria-label="Acceso de ${escapeHTML(worker.name)} al sistema"><span class="access-switch-track" aria-hidden="true"></span><span class="access-switch-text">${blocked ? 'Bloqueado' : 'Acceso'}</span>`;
    head.append(avatar, title, access);

    // Datos en dos columnas.
    const facts = document.createElement('dl');
    facts.className = 'personnel-facts';
    [
      ['Zona', `${worker.city || 'Ciudad sin registrar'}, ${worker.department || 'sin departamento'}`],
      ['Vehículo', `${worker.motorcycle || 'Sin registrar'} · ${worker.plate || '—'}`],
      ['Usuario', worker.username || 'pendiente'],
      ['Fondo inicial', formatMoney(worker.openingAmount || 0)],
    ].forEach(([label, value]) => {
      const item = document.createElement('div');
      item.innerHTML = `<dt>${label}</dt><dd>${escapeHTML(value)}</dd>`;
      facts.append(item);
    });

    const badges = document.createElement('div');
    badges.className = 'personnel-badges';
    const twoFactorBadge = backendEnabled()
      ? '<span class="personnel-badge is-ok">🔒 Verificación en dos pasos obligatoria</span>'
      : `<span class="personnel-badge ${worker.totpSecret ? 'is-ok' : ''}">${worker.totpSecret ? '🔒 2FA activa' : '2FA pendiente (se configura al ingresar)'}</span>`;
    badges.innerHTML = `${twoFactorBadge}${blocked ? '<span class="personnel-badge is-danger">⛔ Acceso bloqueado</span>' : ''}`;

    const expiryList = document.createElement('div');
    expiryList.className = 'vehicle-expiries';
    expiryList.append(createExpiryIndicator('SOAT', worker.soatExpiry), createExpiryIndicator('Técnico-mecánica', worker.technicalExpiry));

    // Acciones: las de uso diario en una fila pareja; las delicadas aparte.
    const button = (label, action, className = '') => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = className;
      element.innerHTML = label;
      element.dataset.personnelAction = action;
      element.dataset.personnelIndex = index;
      return element;
    };
    const actions = document.createElement('footer');
    actions.className = 'personnel-actions';
    const main = document.createElement('div');
    main.className = 'personnel-actions-main';
    main.append(
      button('<span aria-hidden="true">✎</span> Editar', 'edit'),
      button('<span aria-hidden="true">🔑</span> Credenciales', 'credentials'),
      button('<span aria-hidden="true">⌖</span> Ubicación', 'locate', 'worker-location-button'),
    );
    const extra = document.createElement('div');
    extra.className = 'personnel-actions-extra';
    if (worker.totpSecret || backendEnabled()) {
      const reset = button('Restablecer 2FA', 'reset-2fa', 'personnel-link');
      reset.title = 'Úsalo si el trabajador perdió o cambió de celular';
      extra.append(reset);
    }
    extra.append(button('Eliminar', 'delete', 'personnel-link danger-action'));
    actions.append(main, extra);

    card.append(head, facts, badges, expiryList, actions);
    personnelList.append(card);
  });
}

function createExpiryIndicator(label, dateValue) {
  const item = document.createElement('div');
  const remaining = daysUntil(dateValue);
  const level = remaining === null ? 'unknown' : remaining <= 5 ? 'critical' : remaining <= 15 ? 'warning' : remaining <= 30 ? 'soon' : 'safe';
  item.className = `expiry-indicator expiry-${level}`;
  const name = document.createElement('span');
  name.textContent = label;
  const date = document.createElement('strong');
  date.textContent = dateValue ? new Date(`${dateValue}T00:00:00`).toLocaleDateString('es-CO') : 'Sin fecha';
  const note = document.createElement('small');
  note.textContent = remaining === null ? 'Sin registrar' : remaining < 0 ? `Vencido hace ${Math.abs(remaining)} día${Math.abs(remaining) === 1 ? '' : 's'}` : remaining === 0 ? 'Vence hoy' : `Faltan ${remaining} día${remaining === 1 ? '' : 's'}`;
  item.append(name, date, note);
  return item;
}

export function showVehicleExpiryAlert(worker) {
  const expiring = [
    ['SOAT', worker.soatExpiry], ['Técnico-mecánica', worker.technicalExpiry]
  ].map(([label, date]) => ({ label, date, days: daysUntil(date) })).filter(item => item.days !== null && item.days <= 5);
  if (!expiring.length) return;
  // «No recordar más» silencia el aviso para ESTAS fechas; si el admin registra una fecha
  // nueva (renovación), el recordatorio vuelve a funcionar.
  const dismissKey = expiring.map(item => `${item.label}:${item.date}`).join('|');
  if (worker.expiryAlertDismissed === dismissKey) return;
  const days = value => `${value} día${value === 1 ? '' : 's'}`;
  const message = expiring.map(item => `${item.label}: ${item.days < 0 ? `vencido hace ${days(Math.abs(item.days))}` : item.days === 0 ? 'vence hoy' : `vence en ${days(item.days)}`} (${new Date(`${item.date}T00:00:00`).toLocaleDateString('es-CO')})`).join(' · ');
  openCustomModal({
    title: 'Vencimiento vehicular próximo',
    description: `${worker.name}: ${message}. Programa la renovación para continuar operando.`,
    submitLabel: 'Entendido',
    onSubmit: () => {},
    cancelLabel: 'No recordar más',
    onCancel: () => {
      worker.expiryAlertDismissed = dismissKey;
      persistBusinessData();
      showToast('No se volverá a mostrar este aviso hasta que se registre una nueva fecha de vencimiento.');
    },
  });
}

function handlePersonnelAction(action, index) {
  const worker = personnel[index];
  if (!worker) return;
  if (action === 'delete') {
    openCustomModal({
      title: 'Eliminar trabajador', description: `¿Deseas eliminar a ${worker.name} del personal?`, submitLabel: 'Eliminar',
      onSubmit: async () => {
        if (backendEnabled()) {
          try { await adminRpc('admin_delete_user', { target: worker.id }); }
          catch (error) { customModalError.textContent = error.message; return false; }
        }
        personnel.splice(index, 1); refreshRoutesAfterStaffChange(); persistBusinessData(); renderPersonnel();
      }
    });
  } else if (action === 'edit') {
    openCustomModal({
      title: 'Editar trabajador', description: 'Actualiza el perfil, zona de trabajo, vehículo, fondo inicial y vencimientos.',
      fields: [
        { name: 'name', label: 'Nombre del trabajador', value: worker.name, required: true },
        { name: 'route', label: 'Ruta asignada', type: 'text', value: worker.route, required: true },
        { name: 'department', label: 'Departamento donde trabaja', type: 'select', options: departmentOptions(), value: worker.department || '', required: true },
        { name: 'city', label: 'Ciudad / municipio', value: worker.city || '', placeholder: 'Ej. Cúcuta', required: true },
        { name: 'motorcycle', label: 'Modelo de la moto', value: worker.motorcycle || '', required: true },
        { name: 'plate', label: 'Placa', value: worker.plate || '', required: true },
        { name: 'openingAmount', label: 'Monto de apertura del cobro ($)', type: 'number', min: 0, step: 1000, value: worker.openingAmount || 0, required: true },
        { name: 'soatExpiry', label: 'Vencimiento del SOAT', type: 'date', value: worker.soatExpiry || '', required: true },
        { name: 'technicalExpiry', label: 'Vencimiento técnico-mecánica', type: 'date', value: worker.technicalExpiry || '', required: true }
      ],
      onSubmit: values => {
        const routeId = ensureRoute(values.route);
        if (!routeId) { customModalError.textContent = 'Escribe el nombre de la ruta asignada.'; return false; }
        if (!findDepartment(values.department)) { customModalError.textContent = 'Selecciona el departamento donde trabaja.'; return false; }
        const zoneChanged = worker.city !== values.city.trim() || worker.department !== findDepartment(values.department).name || routeKey(worker.route) !== routeId;
        worker.department = findDepartment(values.department).name; worker.city = values.city.trim();
        worker.name = values.name.trim(); worker.route = routeSettlements[routeId].name; worker.motorcycle = values.motorcycle.trim();
        worker.plate = values.plate.trim().toUpperCase(); worker.openingAmount = Number(values.openingAmount);
        worker.soatExpiry = values.soatExpiry; worker.technicalExpiry = values.technicalExpiry;
        if (routeSettlements[routeKey(worker.route)]) {
          routeSettlements[routeKey(worker.route)].base = worker.openingAmount;
          if (routeSelect.value === routeKey(worker.route)) renderAdminRoute(routeSelect.value);
        }
        refreshRoutesAfterStaffChange();
        persistBusinessData();
        renderPersonnel();
        if (zoneChanged || !routeSettlements[routeId]?.mapZone) syncRouteZone(worker);
      }
    });
  } else if (action === 'locate') {
    fetchWorkerLocation(worker);
  } else if (action === 'credentials') {
    openWorkerCredentialModal(worker);
  } else if (action === 'reset-2fa') {
    openCustomModal({
      title: 'Restablecer verificación en dos pasos',
      description: `${worker.name} deberá escanear un código QR nuevo con su app de autenticación en el próximo ingreso. El código anterior y los dispositivos recordados dejarán de funcionar.`,
      submitLabel: 'Restablecer',
      onSubmit: async () => {
        if (backendEnabled()) {
          try { await adminRpc('admin_reset_mfa', { target: worker.id }); }
          catch (error) { customModalError.textContent = error.message; return false; }
        }
        worker.totpSecret = null;
        worker.recoveryHashes = [];
        worker.totpLastStep = -1;
        worker.enrolledAt = null;
        worker.trustVersion = (Number(worker.trustVersion) || 0) + 1; // invalida los dispositivos recordados
        persistBusinessData();
        renderPersonnel();
        showToast(`Verificación en dos pasos de ${worker.name} restablecida.`);
      }
    });
  }
}

function openWorkerCredentialModal(worker) {
  if (state.userRole !== 'admin') return;
  openCustomModal({
    title: `Credenciales de ${worker.name}`,
    description: 'Asigna el usuario y una contraseña inicial o restablecida. El trabajador podrá usarla para ingresar.',
    fields: [
      { name: 'username', label: 'Usuario', value: worker.username, required: true },
      { name: 'newPassword', label: 'Nueva contraseña (mínimo 8 caracteres)', type: 'password', minLength: 8, required: true },
      { name: 'confirmPassword', label: 'Confirmar contraseña', type: 'password', minLength: 8, required: true }
    ],
    submitLabel: 'Guardar acceso',
    onSubmit: async values => {
      const username = values.username.trim().toLocaleLowerCase('es');
      const duplicate = personnel.some(item => item !== worker && item.username?.toLocaleLowerCase('es') === username);
      if (duplicate) { customModalError.textContent = 'Ese usuario ya está asignado a otro trabajador.'; return false; }
      if (values.newPassword !== values.confirmPassword) { customModalError.textContent = 'Las contraseñas no coinciden.'; return false; }
      try {
        if (backendEnabled()) {
          if (username !== worker.username) await adminRpc('admin_set_username', { target: worker.id, new_username: username, email_domain: AUTH_EMAIL_DOMAIN });
          await adminRpc('admin_set_password', { target: worker.id, new_password: values.newPassword });
          worker.username = username;
          persistBusinessData();
          renderPersonnel();
          showToast(`Acceso de ${worker.name} actualizado.`);
          return;
        }
        worker.username = username;
        worker.passwordHash = await hashCredential(values.newPassword);
        persistBusinessData();
        renderPersonnel();
        showToast(`Acceso de ${worker.name} actualizado.`);
      } catch (error) {
        customModalError.textContent = error.message || 'No se pudieron proteger las credenciales en este navegador.';
        return false;
      }
    }
  });
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#add-worker').addEventListener('click', () => {
    openCustomModal({
      title: 'Agregar trabajador', description: 'Registra su asignación, zona de trabajo, vehículo, fondo y vencimientos.',
      fields: [
        { name: 'name', label: 'Nombre del trabajador', required: true },
        { name: 'username', label: 'Usuario inicial', required: true },
        { name: 'initialPassword', label: 'Contraseña inicial (mínimo 8 caracteres)', type: 'password', minLength: 8, required: true },
        { name: 'confirmPassword', label: 'Confirmar contraseña inicial', type: 'password', minLength: 8, required: true },
        { name: 'route', label: 'Ruta asignada (nombre del cobro)', type: 'text', value: '', placeholder: 'Ej. Zulia', required: true },
        { name: 'department', label: 'Departamento donde trabaja', type: 'select', options: departmentOptions(), value: '', required: true },
        { name: 'city', label: 'Ciudad / municipio', placeholder: 'Ej. Cúcuta', required: true },
        { name: 'motorcycle', label: 'Modelo de la moto', required: true },
        { name: 'plate', label: 'Placa', required: true },
        { name: 'openingAmount', label: 'Monto de apertura del cobro ($) · si el cobro es nuevo, entra a la caja', type: 'number', min: 0, step: 1000, value: 0, required: true, money: true },
        { name: 'soatExpiry', label: 'Vencimiento del SOAT', type: 'date', required: true },
        { name: 'technicalExpiry', label: 'Vencimiento técnico-mecánica', type: 'date', required: true }
      ],
      onSubmit: async values => {
        const username = values.username.trim().toLocaleLowerCase('es');
        if (personnel.some(worker => worker.username?.toLocaleLowerCase('es') === username)) { customModalError.textContent = 'Ese usuario ya está asignado a otro trabajador.'; return false; }
        if (values.initialPassword !== values.confirmPassword) { customModalError.textContent = 'Las contraseñas no coinciden.'; return false; }
        let passwordHash;
        try { passwordHash = await hashCredential(values.initialPassword); }
        catch (error) { customModalError.textContent = error.message; return false; }
        const department = findDepartment(values.department);
        if (!department) { customModalError.textContent = 'Selecciona el departamento donde trabaja.'; return false; }
        // ¿El cobro se abre con este trabajador? Entonces su monto de apertura es el capital
        // inicial y entra a la caja. En un cobro que ya existe no toca la caja.
        const existingRoute = routeSettlements[routeKey(values.route)];
        const opensRoute = !existingRoute || (!existingRoute.cashBox?.openingDate && !Object.keys(existingRoute.ledger || {}).length && !(existingRoute.cashEntries || []).length);
        const routeId = ensureRoute(values.route);
        if (!routeId) { customModalError.textContent = 'Escribe el nombre de la ruta asignada.'; return false; }
        const worker = { id: `worker-${Date.now()}`, name: values.name.trim(), username, passwordHash, route: routeSettlements[routeId]?.name || values.route.trim(), department: department.name, city: values.city.trim(), motorcycle: values.motorcycle.trim(), plate: values.plate.trim().toUpperCase(), openingAmount: Number(values.openingAmount), soatExpiry: values.soatExpiry, technicalExpiry: values.technicalExpiry };
        if (backendEnabled()) {
          // La cuenta se crea en Supabase Auth con una función del administrador (admin_create_user); el perfil queda como trabajador de esa ruta.
          try {
            if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('El usuario solo puede tener letras, números, punto o guion (mínimo 3).');
            const db = await backend();
            const { data: newUserId, error } = await db.rpc('admin_create_user', { new_username: username, new_password: values.initialPassword, email_domain: AUTH_EMAIL_DOMAIN });
            if (error) throw error;
            if (!newUserId) throw new Error('El servidor no devolvió el usuario creado.');
            worker.id = newUserId;
            delete worker.passwordHash;
            const { passwordHash: _omit, id, username: _user, ...profileData } = worker;
            const { error: profileError } = await db.from('profiles').update({ role: 'worker', route_id: routeId, access_enabled: true, data: profileData }).eq('user_id', worker.id);
            if (profileError) throw profileError;
          } catch (error) {
            customModalError.textContent = /registered|already/i.test(String(error.message)) ? 'Ese usuario ya existe en el servidor.' : backendErrorMessage(error);
            return false;
          }
        }
        personnel.push(worker);
        if (routeSettlements[routeId]) {
          routeSettlements[routeId].base = worker.openingAmount;
          if (opensRoute && worker.openingAmount > 0) {
            addCashEntry(routeSettlements[routeId], worker.openingAmount, { note: `Apertura del cobro (${worker.name})` });
            showToast(`Cobro ${routeSettlements[routeId].name} abierto: ${formatMoney(worker.openingAmount)} entraron a la caja.`);
          }
          syncRouteSelect();
          routeSelect.value = routeId;
          renderAdminRoute(routeId);
        }
        persistBusinessData();
        renderPersonnel();
        syncRouteZone(worker);
      }
    });
  });
  // Interruptor de acceso individual: bloquea o reactiva el ingreso de un trabajador.
  personnelList.addEventListener('change', event => {
    const input = event.target.closest('[data-personnel-access]');
    if (!input) return;
    const worker = personnel[Number(input.dataset.personnelAccess)];
    if (!worker) return;
    if (input.checked) {
      worker.accessEnabled = true;
      worker.accessChangedAt = new Date().toISOString();
      persistBusinessData();
      renderPersonnel();
      showToast(`Acceso de ${worker.name} reactivado.`);
      return;
    }
    input.checked = true; // se confirma antes de bloquear
    openCustomModal({
      title: 'Desactivar acceso',
      description: `${worker.name} no podrá ingresar aunque tenga usuario, contraseña y código. Si tiene la sesión abierta en este dispositivo, se cerrará.`,
      submitLabel: 'Desactivar acceso',
      onSubmit: () => {
        worker.accessEnabled = false;
        worker.accessChangedAt = new Date().toISOString();
        persistBusinessData();
        renderPersonnel();
        showToast(`Acceso de ${worker.name} desactivado.`);
      }
    });
  });
  personnelList.addEventListener('click', event => {
    const button = event.target.closest('[data-personnel-action]');
    if (button) handlePersonnelAction(button.dataset.personnelAction, Number(button.dataset.personnelIndex));
  });
}
