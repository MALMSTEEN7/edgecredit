// EdgeCredit · Abre un enlace corto de Google Maps (maps.app.goo.gl…) y devuelve sus coordenadas.
//
// El navegador no puede seguir esos enlaces (están en otro dominio), por eso lo hace el servidor.
// Solo abre enlaces de Google, solo para usuarios con sesión iniciada (verify_jwt), sigue como
// máximo 6 redirecciones y no guarda nada.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const GOOGLE_HOST = /^([a-z0-9-]+\.)*(goo\.gl|google\.[a-z.]+|g\.co|googleusercontent\.com)$/i;

const PATTERNS = [
  /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  /[?&](?:q|query|ll|sll|destination|daddr|center|saddr)=(?:loc:)?\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i,
  /\/maps\/(?:search|place|dir)\/(?:[^/]*\/)?(-?\d{1,2}\.\d+),\s*\+?(-?\d{1,3}\.\d+)/i,
  /center=(-?\d{1,2}\.\d+)%2C(-?\d{1,3}\.\d+)/i,
  /\[null,null,(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/,
];

function decoded(text: string): string[] {
  const out = [text];
  let current = text;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(current.replace(/\+/g, ' '));
      if (next === current) break;
      out.push(next);
      current = next;
    } catch { break; }
  }
  return out;
}

function coordinates(text: string) {
  for (const variant of decoded(text)) {
    for (const pattern of PATTERNS) {
      const m = variant.match(pattern);
      if (!m) continue;
      const latitude = Number(m[1]);
      const longitude = Number(m[2]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0)) {
        return { latitude, longitude };
      }
    }
  }
  return null;
}

// Lugares de Google («/maps/place/Nombre/data=…!1s0x…:0x…»): el enlace no trae coordenadas. La
// página trae un enlace interno «/maps/preview/place?…» con los datos del lugar, incluido su punto.
async function placeFromPreview(page: string) {
  const href = page.match(/href="(\/maps\/preview\/place\?[^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
  if (!href) return null;
  try {
    const res = await fetch('https://www.google.com' + href, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9' }, signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    const m = text.match(/\[null,null,(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)\],"0x[0-9a-f]+:0x[0-9a-f]+"/) || text.match(/\[null,null,(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)\]/);
    if (m) return { latitude: Number(m[1]), longitude: Number(m[2]) };
    const view = text.match(/^\)\]\}'\s*\[null,\[\],null,null,\[\[[\d.]+,(-?\d{1,3}\.\d+),(-?\d{1,2}\.\d+)\]/);
    if (view) return { latitude: Number(view[2]), longitude: Number(view[1]) };
  } catch { /* sin respuesta */ }
  return null;
}

// Último recurso: el primer número del código del lugar («0x…:0x…») es una celda S2 de Google
// con la posición del lugar (en las pruebas, a pocos metros del punto real).
const S2_LOOKUP_IJ: number[] = new Array(1024).fill(0);
(() => {
  const POS_TO_IJ = [[0, 1, 3, 2], [0, 2, 3, 1], [3, 2, 0, 1], [3, 1, 0, 2]];
  const POS_TO_ORIENT = [1, 0, 0, 3];
  const init = (level: number, i: number, j: number, orig: number, pos: number, orient: number) => {
    if (level === 4) { S2_LOOKUP_IJ[(pos << 2) + orig] = (((i << 4) + j) << 2) + orient; return; }
    const r = POS_TO_IJ[orient];
    for (let idx = 0; idx < 4; idx++) init(level + 1, (i << 1) + (r[idx] >> 1), (j << 1) + (r[idx] & 1), orig, (pos << 2) + idx, orient ^ POS_TO_ORIENT[idx]);
  };
  for (let o = 0; o < 4; o++) init(0, 0, 0, o, 0, o);
})();
function s2CellToLatLng(hex: string) {
  const id = BigInt(hex);
  const face = Number(id >> 61n);
  if (face > 5) return null;
  let bits = face & 1, i = 0, j = 0;
  for (let k = 7; k >= 0; k--) {
    const nbits = k === 7 ? 2 : 4;
    bits += Number((id >> BigInt(k * 8 + 1)) & BigInt((1 << (2 * nbits)) - 1)) << 2;
    bits = S2_LOOKUP_IJ[bits];
    i += (bits >> 6) * 2 ** (k * 4);
    j += ((bits >> 2) & 15) * 2 ** (k * 4);
    bits &= 3;
  }
  const MAX = 2 ** 30;
  const stToUv = (s: number) => (s >= 0.5 ? (4 * s * s - 1) / 3 : (1 - 4 * (1 - s) * (1 - s)) / 3);
  const u = stToUv((2 * i + 1) / (2 * MAX));
  const v = stToUv((2 * j + 1) / (2 * MAX));
  const [x, y, z] = [[1, u, v], [-u, 1, v], [-u, -v, 1], [-1, -v, -u], [v, -1, -u], [v, u, -1]][face];
  return { latitude: Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI, longitude: Math.atan2(y, x) * 180 / Math.PI };
}
function placeFromFeatureId(text: string) {
  for (const variant of decoded(text)) {
    const hex = variant.match(/(?:!1s|ftid=)(0x[0-9a-f]{8,16}):0x[0-9a-f]+/i)?.[1];
    if (hex) return s2CellToLatLng(hex);
  }
  return null;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  // La firma del token ya la verificó Supabase (verify_jwt); aquí solo se exige sesión iniciada
  // (la clave pública «anon» también es un token válido, pero no es de un usuario).
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4)));
    if (payload?.role !== 'authenticated') return json({ error: 'Inicia sesión para usar esta función' }, 401);
  } catch {
    return json({ error: 'Inicia sesión para usar esta función' }, 401);
  }
  let url: URL;
  try {
    const body = await req.json();
    url = new URL(String(body?.url || ''));
  } catch {
    return json({ error: 'Enlace no válido' }, 400);
  }
  if (!/^https?:$/.test(url.protocol) || !GOOGLE_HOST.test(url.hostname)) return json({ error: 'Solo se aceptan enlaces de Google Maps' }, 400);

  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const found = coordinates(current.href);
    if (found) return json({ ...found, final: current.href });
    let res: Response;
    try {
      res = await fetch(current.href, { redirect: 'manual', headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9' }, signal: AbortSignal.timeout(8000) });
    } catch {
      return json({ error: 'No se pudo abrir el enlace' }, 502);
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      const next = new URL(location, current);
      if (!GOOGLE_HOST.test(next.hostname)) return json({ error: 'El enlace no lleva a Google Maps' }, 400);
      current = next;
      continue;
    }
    // Página final: un lugar de Google; sus datos vienen aparte (preview) o en su código.
    const text = (await res.text()).slice(0, 800000);
    const preview = await placeFromPreview(text);
    if (preview) return json({ ...preview, final: current.href, source: 'lugar' });
    const inPage = coordinates(text);
    if (inPage) return json({ ...inPage, final: current.href });
    const approx = placeFromFeatureId(current.href);
    if (approx) return json({ ...approx, final: current.href, source: 'codigo', approximate: true });
    break;
  }
  return json({ error: 'El enlace no trae las coordenadas (puede ser solo una dirección escrita)', final: current.href }, 422);
});
