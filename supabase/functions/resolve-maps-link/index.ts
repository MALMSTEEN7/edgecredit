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
      res = await fetch(current.href, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'Accept-Language': 'es-CO,es;q=0.9' }, signal: AbortSignal.timeout(8000) });
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
    // Página final: a veces las coordenadas solo están dentro del contenido.
    const text = (await res.text()).slice(0, 600000);
    const inPage = coordinates(text);
    if (inPage) return json({ ...inPage, final: current.href });
    break;
  }
  return json({ error: 'El enlace no trae las coordenadas (puede ser solo una dirección escrita)', final: current.href }, 422);
});
