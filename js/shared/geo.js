/**
 * shared/geo · Captura de la posición GPS del dispositivo sin bloquear la operación.
 * Nunca rechaza: si no hay permiso, señal o soporte, resuelve con null.
 */
export function captureLocation({ timeout = 10000, maximumAge = 60000 } = {}) {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise(resolve => {
    let settled = false;
    const done = value => { if (!settled) { settled = true; resolve(value); } };
    // Algunos navegadores nunca responden si el usuario ignora el aviso de permiso.
    const guard = window.setTimeout(() => done(null), timeout + 1000);
    navigator.geolocation.getCurrentPosition(position => {
      window.clearTimeout(guard);
      done({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
        capturedAt: new Date(position.timestamp || Date.now()).toISOString()
      });
    }, () => { window.clearTimeout(guard); done(null); }, { enableHighAccuracy: true, timeout, maximumAge });
  });
}

export const hasCoordinates = location => Boolean(location) && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));

const GEOCODE_CACHE_KEY = 'edgecredit-geocode-cache';

/**
 * Busca un municipio de Colombia en OpenStreetMap (Nominatim) y devuelve su recuadro
 * { bbox: [sur, oeste, norte, este], center: [lat, lng], label } o null.
 * Resultados en caché por dispositivo para no repetir consultas (política de uso de Nominatim).
 */
export async function geocodeMunicipality(city, departmentName = '') {
  const name = String(city || '').trim();
  if (!name) return null;
  const key = `${name}|${departmentName}`.toLocaleLowerCase('es');
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}'); } catch { /* caché opcional */ }
  if (cache[key]) return cache[key];
  const query = [name, departmentName.replace(' D.C.', ''), 'Colombia'].filter(Boolean).join(', ');
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'co', q: query });
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json', 'Accept-Language': 'es' }, signal: controller.signal });
    if (!response.ok) return null;
    const [place] = await response.json();
    if (!place?.boundingbox) return null;
    const [south, north, west, east] = place.boundingbox.map(Number);
    const result = { bbox: [south, west, north, east], center: [Number(place.lat), Number(place.lon)], label: name };
    cache[key] = result;
    try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch { /* caché opcional */ }
    return result;
  } catch { return null; } finally { window.clearTimeout(timer); }
}
