/**
 * features/clients/client-location · Cambiar la ubicación del domicilio de un cliente.
 *
 * - «Pegar ubicación»: el cliente manda su ubicación por WhatsApp o un enlace de Google Maps y
 *   se pega aquí. Los enlaces cortos (maps.app.goo.gl) los abre el servidor
 *   (supabase/functions/resolve-maps-link) para sacar las coordenadas.
 * - «Estoy en la casa: actualizar ubicación» (al registrar un abono): toma el GPS del celular.
 *   Si la ubicación del celular está bloqueada, muestra los pasos para activarla.
 * La ubicación anterior queda en `client.locationHistory` (las últimas 5).
 */

import { customModalError } from '../../core/dom.js';
import { backend, backendEnabled } from '../../core/backend.js';
import { state } from '../../core/state.js';
import { clients, persistBusinessData } from '../../core/store.js';
import { trackDistance } from '../../core/tracks.js';
import { hasCoordinates, isApproximateLocation, locateDevice } from '../../shared/geo.js';
import { coordinatesFromText, firstLink, isGoogleMapsLink, isShortMapsLink } from '../../shared/maps-link.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';
import { gpsState, openGpsHelp, recentGpsFix } from '../worker/location.js';

/** Precisión mínima para aceptar la ubicación tomada en la casa (más que esto no se guarda). */
const HOME_LOCATION_MAX_METERS = 150;

function whoChanges() {
  return state.userRole === 'admin' ? 'Administrador' : state.activeWorker?.name || 'Trabajador';
}

/** Guarda la nueva ubicación del domicilio (la anterior queda en el historial). */
export function saveClientLocation(clientId, point) {
  const client = clients[clientId];
  if (!client) return false;
  if (hasCoordinates(client.location)) {
    client.locationHistory = [{ ...client.location, replacedAt: new Date().toISOString(), replacedBy: whoChanges() }, ...(client.locationHistory || [])].slice(0, 5);
  }
  client.location = { ...point, capturedAt: point.capturedAt || new Date().toISOString(), by: whoChanges() };
  delete client.locationPending;
  delete client.locationFailure;
  persistBusinessData();
  document.dispatchEvent(new CustomEvent('edgecredit:client-location', { detail: { clientId } }));
  return true;
}

function distanceCopy(client, point) {
  if (!hasCoordinates(client.location)) return 'El cliente no tenía ubicación guardada.';
  const meters = trackDistance({ latitude: Number(client.location.latitude), longitude: Number(client.location.longitude) }, point);
  const text = meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(meters)} m`;
  return `Queda a ${text} de la ubicación que tenía guardada.`;
}

/** Abre un enlace corto en el servidor y devuelve sus coordenadas. */
async function resolveShortLink(url) {
  if (!backendEnabled()) throw new Error('Para leer enlaces cortos se necesita conexión con el servidor.');
  const db = await backend();
  const { data, error } = await db.functions.invoke('resolve-maps-link', { body: { url } });
  if (data && Number.isFinite(Number(data.latitude))) return { latitude: Number(data.latitude), longitude: Number(data.longitude) };
  let message = data?.error;
  if (!message && error?.context?.json) { try { message = (await error.context.json())?.error; } catch { /* sin detalle */ } }
  if (!message && /fetch|network|Failed/i.test(String(error?.message || ''))) message = 'Sin conexión. Inténtalo cuando tengas señal.';
  throw new Error(message || 'No se pudo leer el enlace.');
}

/** Coordenadas del texto pegado (enlace o coordenadas). */
export async function locationFromPastedText(text) {
  const direct = coordinatesFromText(text);
  if (direct) return direct;
  const link = firstLink(text);
  if (link && (isShortMapsLink(link) || isGoogleMapsLink(link))) return resolveShortLink(link);
  throw new Error(link
    ? 'Ese enlace no es de Google Maps. Pide al cliente que comparta su ubicación desde Google Maps o WhatsApp.'
    : 'No se encontró una ubicación. Pega el enlace que mandó el cliente o las coordenadas (ej. 7.8939, -72.5078).');
}

/** «Pegar ubicación de Maps / WhatsApp». */
export function openPasteLocation(clientId) {
  const client = clients[clientId];
  if (!client) return;
  openCustomModal({
    title: 'Pegar ubicación del cliente',
    description: `Pide a ${client.name} que te mande su ubicación por WhatsApp (📎 → Ubicación → Enviar tu ubicación actual, estando en su casa) o el enlace de Google Maps (Compartir). Mantén presionado el mensaje, copia el enlace y pégalo aquí.`,
    fields: [{ name: 'link', label: 'Enlace o coordenadas', type: 'textarea', required: true, placeholder: 'https://maps.app.goo.gl/…  ó  7.8939, -72.5078' }],
    submitLabel: 'Revisar ubicación',
    onSubmit: async values => {
      const save = document.querySelector('#custom-modal-save');
      const label = save.textContent;
      save.disabled = true;
      save.textContent = 'Leyendo enlace…';
      let point;
      try { point = await locationFromPastedText(values.link); }
      catch (error) { customModalError.textContent = error.message; return false; }
      finally { save.disabled = false; save.textContent = label; }
      const target = clients[clientId];
      if (!target) return true;
      window.setTimeout(() => confirmPastedLocation(clientId, point), 0);
      return true;
    },
  });
}

function confirmPastedLocation(clientId, point) {
  const client = clients[clientId];
  if (!client) return;
  const coords = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
  openCustomModal({
    title: '¿Guardar esta ubicación?',
    description: `Nueva ubicación del domicilio de ${client.name}: ${coords}. ${distanceCopy(client, point)} Después de guardarla, revísala con «Ver ubicación del domicilio».`,
    submitLabel: 'Guardar ubicación',
    extraAction: { label: 'Ver en Google Maps', onClick: () => { window.open(`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`, '_blank', 'noopener,noreferrer'); window.setTimeout(() => confirmPastedLocation(clientId, point), 300); } },
    onSubmit: () => {
      saveClientLocation(clientId, { latitude: point.latitude, longitude: point.longitude, accuracy: null, source: 'enlace' });
      showToast(`Ubicación de ${client.name} guardada desde el enlace.`);
    },
  });
}

/**
 * «Estoy en la casa: actualizar ubicación» (trabajador). Devuelve un texto con el resultado.
 * Si la ubicación del celular está bloqueada, abre los pasos para activarla.
 */
export async function takeLocationHere(clientId) {
  const client = clients[clientId];
  if (!client) return '';
  const current = gpsState();
  if (current === 'denied' || current === 'unsupported') { openGpsHelp(current); return 'Activa la ubicación del celular y vuelve a intentarlo.'; }
  // El GPS del trabajador ya está encendido: si acaba de dar una posición buena, se usa esa.
  const recent = recentGpsFix(20000);
  const { location, reason } = recent && recent.accuracy <= HOME_LOCATION_MAX_METERS
    ? { location: recent, reason: null }
    : await locateDevice({ timeout: 12000 });
  if (!location) {
    if (reason === 'denied' || reason === 'unsupported') { openGpsHelp(reason); return 'Activa la ubicación del celular y vuelve a intentarlo.'; }
    if (reason === 'unavailable') openGpsHelp('searching');
    return 'No se pudo tomar la ubicación (sin señal de GPS). Sal a cielo abierto e inténtalo de nuevo.';
  }
  if (location.accuracy > HOME_LOCATION_MAX_METERS) {
    return `La ubicación salió muy imprecisa (± ${location.accuracy} m) y no se guardó. Inténtalo de nuevo frente a la casa, al aire libre.`;
  }
  const before = hasCoordinates(client.location) ? distanceCopy(client, location) : '';
  saveClientLocation(clientId, { ...location, source: 'abono' });
  const note = `Ubicación de ${client.name} actualizada (± ${location.accuracy} m).${isApproximateLocation(location) ? ' Es aproximada.' : ''}`;
  showToast(`${note} ${before}`.trim());
  return note;
}
