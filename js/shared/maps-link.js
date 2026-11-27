/**
 * shared/maps-link · Leer una ubicación pegada por el usuario: enlace de Google Maps, ubicación
 * compartida por WhatsApp, enlace «geo:» o coordenadas escritas («7.8939, -72.5078»).
 *
 * Los enlaces cortos (maps.app.goo.gl, goo.gl/maps) no traen las coordenadas: hay que abrirlos.
 * Eso lo hace el servidor (supabase/functions/resolve-maps-link), porque el navegador no puede.
 */

/** Intenta decodificar el texto (los enlaces traen «%2C» en vez de la coma, etc.). */
function decodedVariants(text) {
  const variants = [text];
  let current = text;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(current.replace(/\+/g, ' '));
      if (next === current) break;
      variants.push(next);
      current = next;
    } catch { break; }
  }
  return variants;
}

const COORDINATE_PATTERNS = [
  /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,                                   // lugar: …!3d7.89!4d-72.5
  /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,                                     // vista: /@7.89,-72.5,17z
  /[?&](?:q|query|ll|sll|destination|daddr|center|saddr)=(?:loc:)?\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i,
  /geo:(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/i,                                 // geo:7.89,-72.5
  /\/maps\/(?:search|place|dir)\/(?:[^/]*\/)?(-?\d{1,2}\.\d+),\s*\+?(-?\d{1,3}\.\d+)/i,
  /(?:^|[^\d.])(-?\d{1,2}\.\d{3,})\s*[,;]\s*(-?\d{1,3}\.\d{3,})(?![\d.])/,     // «7.8939, -72.5078»
];

/** Coordenadas válidas dentro del texto, o null. */
export function coordinatesFromText(text) {
  for (const variant of decodedVariants(String(text || ''))) {
    for (const pattern of COORDINATE_PATTERNS) {
      const match = variant.match(pattern);
      if (!match) continue;
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0)) {
        return { latitude, longitude };
      }
    }
  }
  return null;
}

/** Primer enlace del texto (WhatsApp pega «Mi ubicación: https://…»). */
export function firstLink(text) {
  return String(text || '').match(/https?:\/\/[^\s<>"']+/i)?.[0] || '';
}

/** Enlace corto de Google Maps que hay que abrir en el servidor para ver las coordenadas. */
export function isShortMapsLink(url) {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(url);
}

/** ¿Es un enlace de Google Maps (o de Google) que el servidor puede abrir? */
export function isGoogleMapsLink(url) {
  return /^https?:\/\/([a-z0-9-]+\.)*(goo\.gl|google\.[a-z.]+|g\.co)\//i.test(url);
}
