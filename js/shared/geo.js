/**
 * shared/geo · Captura de la posición GPS del dispositivo sin bloquear la operación.
 * Nunca rechaza: resuelve con { location, reason }. Si no hay ubicación, `reason` dice por
 * qué: 'denied' (permiso negado), 'unavailable' (sin señal), 'timeout' o 'unsupported'.
 */
export function locateDevice({ timeout = 10000 } = {}) {
  if (!navigator.geolocation) return Promise.resolve({ location: null, reason: 'unsupported' });
  return new Promise(resolve => {
    let settled = false;
    const done = value => { if (!settled) { settled = true; resolve(value); } };
    // Algunos navegadores nunca responden si el usuario ignora el aviso de permiso.
    const guard = window.setTimeout(() => done({ location: null, reason: 'timeout' }), timeout + 500);
    navigator.geolocation.getCurrentPosition(position => {
      window.clearTimeout(guard);
      done({
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        },
        reason: null,
      });
    }, error => {
      window.clearTimeout(guard);
      done({ location: null, reason: error?.code === 1 ? 'denied' : error?.code === 3 ? 'timeout' : 'unavailable' });
    }, { enableHighAccuracy: true, timeout, maximumAge: 0 }); // posición nueva: se toma en el domicilio
  });
}

export const LOCATION_FAILURE_LABELS = {
  denied: 'permiso de ubicación negado',
  unavailable: 'sin señal de GPS',
  timeout: 'se acabó el tiempo de espera',
  unsupported: 'este navegador no da la ubicación',
};

/** Precisión (en metros) a partir de la cual la ubicación se guarda pero se avisa que es aproximada. */
export const APPROXIMATE_LOCATION_METERS = 100;

export const isApproximateLocation = location => Number(location?.accuracy) > APPROXIMATE_LOCATION_METERS;

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
