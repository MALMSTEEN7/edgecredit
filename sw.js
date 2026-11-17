/*
 * EdgeCredit · service worker: la app abre sin señal.
 *
 * - Página (index.html) y config.js: primero internet (máximo NAV_TIMEOUT_MS); si no hay o
 *   tarda demasiado, la copia guardada. Así las actualizaciones llegan igual que antes.
 * - JS/CSS con sello de versión (dist/…?v=) y la librería del servidor (dist/vendor/):
 *   primero la copia guardada (nunca cambian para un mismo sello).
 * - Íconos y manifiesto: copia guardada y se refresca en segundo plano.
 * - Nada de otros dominios (Supabase, mapas…) pasa por aquí: lo maneja el navegador.
 *
 * Interruptor de emergencia: publicar un sw.js con `const KILL = true` borra las copias y
 * se desinstala en el siguiente arranque con internet.
 */
const KILL = false;
const CACHE = 'edgecredit-app-v1';
const NAV_TIMEOUT_MS = 4000;
const CORE = ['./', 'config.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'dist/vendor/supabase-2.119.0.js'];

const versionOf = html => (/const APP_VERSION = '([^']+)'/.exec(html) || [])[1] || '';
const assetsFor = version => version ? [`dist/app.bundle.js?v=${version}`, `dist/styles.bundle.css?v=${version}`] : [];

/** Guarda la página solo cuando su JS y CSS ya están guardados (nunca una página sin su código). */
async function storePage(cache, request, response) {
  const html = await response.clone().text();
  const assets = assetsFor(versionOf(html));
  for (const asset of assets) {
    if (await cache.match(asset)) continue;
    const fetched = await fetch(asset, { cache: 'no-cache' });
    if (!fetched.ok) return;
    await cache.put(asset, fetched);
  }
  await cache.put(request, response);
  // Versiones viejas del JS/CSS: ya no hacen falta.
  const keep = new Set(assets.map(asset => new URL(asset, self.registration.scope).href));
  for (const key of await cache.keys()) {
    if (/\/dist\/(app\.bundle\.js|styles\.bundle\.css)\?/.test(key.url) && !keep.has(key.url)) await cache.delete(key);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    if (KILL) return self.skipWaiting();
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.filter(url => url !== './').map(url => cache.add(new Request(url, { cache: 'no-cache' })).catch(() => {})));
    try {
      const page = await fetch('./', { cache: 'no-cache' });
      if (page.ok) await storePage(cache, new Request('./'), page);
    } catch { /* se guarda en la próxima visita con internet */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (KILL) {
      await Promise.all((await caches.keys()).map(key => caches.delete(key)));
      await self.registration.unregister();
      return;
    }
    await Promise.all((await caches.keys()).filter(key => key.startsWith('edgecredit-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** Página: internet con tiempo límite; si falla, la guardada. */
async function networkFirstPage(event) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request, { cache: 'no-cache' });
  // Lo que llegue (aunque sea tarde) se guarda para la próxima vez.
  event.waitUntil(network.then(response => response.ok ? storePage(cache, new Request('./'), response.clone()) : null).catch(() => {}));
  try {
    const response = await withTimeout(network, NAV_TIMEOUT_MS);
    if (response.ok) return response;
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    const saved = await cache.match('./');
    if (saved) return saved;
    return network; // primera visita sin copia: se espera a la red
  }
}

async function networkFirst(event) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request, { cache: 'no-cache' });
  event.waitUntil(network.then(response => response.ok ? cache.put(event.request, response.clone()) : null).catch(() => {}));
  try {
    const response = await withTimeout(network, NAV_TIMEOUT_MS);
    if (response.ok) return response;
    throw new Error(`HTTP ${response.status}`);
  } catch {
    return (await cache.match(event.request, { ignoreSearch: true })) || network;
  }
}

async function cacheFirst(event, { fallbackIgnoreSearch = false } = {}) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(event.request);
  if (saved) return saved;
  try {
    const response = await fetch(event.request);
    if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
    return response;
  } catch (error) {
    // Sin señal y sin esta versión exacta: la última guardada del mismo archivo.
    const any = fallbackIgnoreSearch && await cache.match(event.request, { ignoreSearch: true });
    if (any) return any;
    throw error;
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(event.request, { ignoreSearch: true });
  const network = fetch(event.request).then(response => { if (response.ok) cache.put(event.request, response.clone()); return response; });
  if (saved) { event.waitUntil(network.catch(() => {})); return saved; }
  return network;
}

self.addEventListener('fetch', event => {
  if (KILL) return;
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  if (request.mode === 'navigate') { event.respondWith(networkFirstPage(event)); return; }
  if (path === 'config.js') { event.respondWith(networkFirst(event)); return; }
  if (path.startsWith('dist/vendor/')) { event.respondWith(cacheFirst(event)); return; }
  if (path.startsWith('dist/') && url.searchParams.has('v')) { event.respondWith(cacheFirst(event, { fallbackIgnoreSearch: true })); return; }
  if (['manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'].includes(path)) { event.respondWith(staleWhileRevalidate(event)); return; }
  // Lo demás (módulos de desarrollo, etc.): sin intervenir.
});
