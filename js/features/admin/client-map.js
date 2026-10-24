/**
 * features/admin/client-map · Mapa de clientes del cobro seleccionado.
 * Colorea cada cliente por su comportamiento de pago (mismo criterio que la biblioteca),
 * enfoca el departamento del trabajador asignado y se extiende hasta donde haya clientes.
 * Leaflet se carga bajo demanda la primera vez que se abre la sección.
 */

import { routeSelect } from '../../core/dom.js';
import { state } from '../../core/state.js';
import { COLOMBIA_BOUNDS, findDepartment } from '../../core/geo-colombia.js';
import { CARTO_API_KEY } from '../../core/map-config.js';
import { clients, persistBusinessData, routeSettlements, workerForRoute } from '../../core/store.js';
import { paymentBehavior } from '../../domain/loan-schedule.js';
import { openOperationsClient } from '../operations/operations-list.js';
import { formatMoney } from '../../shared/format.js';
import { geocodeMunicipality, hasCoordinates } from '../../shared/geo.js';
import { showToast } from '../../ui/toast.js';

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const ESRI_ATTRIBUTION = 'Imágenes &copy; Esri, Maxar, Earthstar Geographics y la comunidad GIS';
const BASEMAP_STORAGE_KEY = 'edgecredit-map-basemap';
// Capas base. "Calles" (por defecto) y "Oscuro" usan CARTO con la key de core/map-config.js;
// "Satélite" usa Esri y no requiere key.
const cartoLayer = (L, style) => L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png?key=${encodeURIComponent(CARTO_API_KEY)}`, { attribution: CARTO_ATTRIBUTION, subdomains: 'abcd', maxZoom: 20 });
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const BASEMAPS = {
  'Calles': L => CARTO_API_KEY
    ? cartoLayer(L, 'voyager')
    : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: OSM_ATTRIBUTION, maxZoom: 19 }),
  'Satélite': L => L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: ESRI_ATTRIBUTION, maxZoom: 19 }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
  ]),
  ...(CARTO_API_KEY ? { 'Oscuro': L => cartoLayer(L, 'dark_all') } : {}),
};

export const TIER_COLORS = { good: '#00C853', regular: '#FF9800', bad: '#E53935' };
const TIER_LABELS = { good: 'Al día', regular: '1 pago atrasado', bad: '2 o más pagos atrasados' };
const SOURCE_LABELS = { alta: 'GPS tomado al crear el cliente', ficha: 'GPS tomado desde la ficha del cliente', abono: 'GPS tomado en un abono', admin: 'Ubicado manualmente por el administrador', trabajador: 'Ubicado manualmente por el trabajador', demo: 'Ubicación de demostración' };

let leafletPromise = null;
let map = null;
let markerLayer = null;
let lastFitKey = '';
let pickClientId = null;
let pickKind = 'main';          // 'main' = domicilio, 'alt' = dirección alternativa
let altLayer = null;            // capa con la dirección alternativa visible (máx. un cliente)
let shownAltClientId = null;    // cliente cuya dirección alternativa se está mostrando
let pendingFit = null;
let focusedClientId = null;     // cliente resaltado en la lista "En el mapa"          // encuadre pendiente hasta que el contenedor tenga tamaño
const markersById = new Map();  // clientId -> marcador, para "ir a" desde la lista
const MIN_SPAN = 0.012;         // ~1,3 km: perímetro mínimo alrededor de los clientes
const FOCUS_ZOOM = 17;          // zoom al seleccionar un cliente puntual
const visibleTiers = new Set(['good', 'regular', 'bad']);

const $ = selector => document.querySelector(selector);

/**
 * El mismo mapa sirve al admin (cobro elegido) y al trabajador (solo su propio cobro).
 * Ambos pueden ubicar y reubicar clientes; solo el admin fija la zona del cobro.
 */
const isWorkerMap = () => state.userRole === 'worker';
const mapRouteId = () => (isWorkerMap() ? state.workerRoute : routeSelect.value);

/** Mueve el bloque del mapa al contenedor de la vista activa (panel admin o vista del trabajador). */
function attachMapHost() {
  const layout = document.querySelector('.client-map-layout');
  const host = document.querySelector(isWorkerMap() ? '#worker-map-host' : '#admin-map-host');
  if (layout && host && layout.parentElement !== host) host.append(layout);
  layout?.classList.toggle('is-read-only', isWorkerMap());
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.append(css);
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet no disponible')));
    script.onerror = () => { script.remove(); leafletPromise = null; reject(new Error('Sin conexión al servicio de mapas')); };
    document.head.append(script);
  });
  return leafletPromise;
}

function showMessage(text) {
  const message = $('#client-map-message');
  message.textContent = text;
  message.hidden = !text;
}

function routeEntries(routeId) {
  return Object.entries(clients)
    .filter(([, client]) => client.route === routeId)
    .map(([id, client]) => ({ id, client, risk: paymentBehavior(client) }));
}

function renderSidebar(entries) {
  const counts = { good: 0, regular: 0, bad: 0 };
  entries.forEach(entry => { counts[entry.risk.tier] += 1; });
  Object.entries(counts).forEach(([tier, count]) => { $(`[data-tier-count="${tier}"]`).textContent = String(count); });

  const missing = entries.filter(entry => !hasCoordinates(entry.client.location));
  $('#client-map-missing-count').textContent = String(missing.length);
  const list = $('#client-map-missing');
  list.replaceChildren();
  if (!missing.length) {
    const empty = document.createElement('p');
    empty.className = 'client-map-empty';
    empty.textContent = 'Todos los clientes de este cobro están ubicados.';
    list.append(empty);
    return;
  }
  missing.forEach(({ id, client, risk }) => {
    const row = document.createElement('div');
    row.className = 'client-map-missing-row';
    const dot = document.createElement('i');
    dot.className = 'client-map-dot';
    dot.style.setProperty('--tier-color', TIER_COLORS[risk.tier]);
    dot.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = client.name;
    const address = document.createElement('small');
    address.textContent = client.address || 'Sin dirección';
    copy.append(name, address);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-action map-action-small';
    button.dataset.mapPick = id;
    button.textContent = 'Ubicar';
    if (pickClientId === id) { button.classList.add('is-active'); button.textContent = 'Ubicando…'; button.setAttribute('aria-pressed', 'true'); }
    button.setAttribute('aria-label', `Ubicar a ${client.name} en el mapa`);
    row.append(dot, copy, button);
    list.append(row);
  });
}

function popupContent(id, client, risk) {
  const box = document.createElement('div');
  box.className = 'client-map-popup';
  const name = document.createElement('strong');
  name.textContent = client.name;
  const tier = document.createElement('span');
  tier.className = 'client-map-popup-tier';
  tier.style.setProperty('--tier-color', TIER_COLORS[risk.tier]);
  tier.textContent = risk.label;
  const facts = document.createElement('dl');
  [['Cédula', client.id], ['Saldo', formatMoney(client.balance)], ['Cuota', formatMoney(client.installment)], ['Dirección', client.address || '—'], ...(client.altAddress ? [['Dir. alternativa', client.altAddress]] : [])].forEach(([label, value]) => {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value;
    facts.append(dt, dd);
  });
  const source = document.createElement('small');
  const accuracy = Number(client.location?.accuracy);
  const takenAt = client.location?.capturedAt ? new Date(client.location.capturedAt) : null;
  source.textContent = [
    SOURCE_LABELS[client.location?.source] || 'Ubicación registrada',
    Number.isFinite(accuracy) && accuracy > 0 ? `± ${Math.round(accuracy)} m${accuracy > 100 ? ' (aproximada)' : ''}` : '',
    takenAt && !Number.isNaN(takenAt.getTime()) ? takenAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
  ].filter(Boolean).join(' · ');
  const actions = document.createElement('div');
  actions.className = 'client-map-popup-actions';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'primary-button';
  open.textContent = 'Ver ficha';
  open.addEventListener('click', () => openOperationsClient(id));
  const move = document.createElement('button');
  move.type = 'button';
  move.className = 'secondary-button';
  move.textContent = 'Reubicar';
  move.addEventListener('click', () => { map.closePopup(); startPick(id); });
  actions.append(directionsLink(client.location, `el domicilio de ${client.name}`), open);
  actions.append(move);
  if (client.altAddress) actions.append(altAddressButton(id, client));
  box.append(name, tier, facts, source, actions);
  return box;
}

/** Muestra en el mapa SOLO la dirección alternativa de este cliente (oculta cualquier otra). */
function showAltLocation(id) {
  const L = window.L;
  const client = clients[id];
  hideAltLocation();
  if (!L || !client || !hasCoordinates(client.altLocation)) return null;
  const risk = paymentBehavior(client);
  altLayer ||= L.layerGroup().addTo(map);
  shownAltClientId = id;
  return L.circleMarker([Number(client.altLocation.latitude), Number(client.altLocation.longitude)], {
    radius: 7, weight: 3, color: TIER_COLORS[risk.tier], fillColor: '#FFFFFF', fillOpacity: 0.95, dashArray: '3 3'
  })
    .bindTooltip(`${client.name} · dirección alternativa`, { direction: 'top', offset: [0, -6] })
    .bindPopup(() => altPopupContent(id, client, risk), { minWidth: 230 })
    .addTo(altLayer);
}

/** Oculta la dirección alternativa visible (al pasar a otro cliente o cambiar de cobro). */
function hideAltLocation() {
  altLayer?.clearLayers();
  shownAltClientId = null;
}

/** Botón "Dirección alternativa": lleva a esa ubicación o, si aún no está ubicada, permite marcarla. */
/**
 * Botón "Cómo llegar": abre Google Maps con la ruta desde la ubicación actual hasta el
 * punto del cliente. En el celular abre la app de Google Maps lista para navegar.
 */
function directionsLink(location, label) {
  const link = document.createElement('a');
  link.className = 'map-action client-map-directions';
  link.href = `https://www.google.com/maps/dir/?api=1&destination=${Number(location.latitude)},${Number(location.longitude)}&travelmode=driving`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.innerHTML = '<span aria-hidden="true">➤</span><span class="map-action-label">Cómo llegar · Google Maps</span>';
  link.setAttribute('aria-label', `Cómo llegar a ${label} en Google Maps`);
  return link;
}

function altAddressButton(id, client) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-action client-map-alt-button';
  const located = hasCoordinates(client.altLocation);
  button.innerHTML = `<span aria-hidden="true">⇄</span><span class="map-action-label">${located ? 'Ir a dirección alternativa' : 'Ubicar dirección alternativa'}</span>`;
  button.title = client.altAddress;
  button.addEventListener('click', () => {
    map.closePopup();
    if (located) {
      const altMarker = showAltLocation(id);
      focusLocation(client.altLocation, () => altMarker?.openPopup());
    }
    else startPick(id, 'alt');
  });
  return button;
}

/** Ficha rápida del punto de la dirección alternativa, con regreso al domicilio. */
function altPopupContent(id, client, risk) {
  const box = document.createElement('div');
  box.className = 'client-map-popup';
  const name = document.createElement('strong');
  name.textContent = client.name;
  const kind = document.createElement('span');
  kind.className = 'client-map-popup-tier';
  kind.style.setProperty('--tier-color', TIER_COLORS[risk.tier]);
  kind.textContent = 'Dirección alternativa';
  const address = document.createElement('small');
  address.textContent = client.altAddress || '—';
  const actions = document.createElement('div');
  actions.className = 'client-map-popup-actions';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'map-action client-map-alt-button';
  back.innerHTML = '<span aria-hidden="true">⌂</span><span class="map-action-label">Ir al domicilio</span>';
  back.disabled = !hasCoordinates(client.location);
  back.addEventListener('click', () => { map.closePopup(); focusLocation(client.location, () => markersById.get(id)?.openPopup()); });
  const move = document.createElement('button');
  move.type = 'button';
  move.className = 'secondary-button';
  move.textContent = 'Reubicar';
  move.addEventListener('click', () => { map.closePopup(); startPick(id, 'alt'); });
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'primary-button';
  open.textContent = 'Ver ficha';
  open.addEventListener('click', () => openOperationsClient(id));
  if (hasCoordinates(client.altLocation)) actions.append(directionsLink(client.altLocation, `la dirección alternativa de ${client.name}`));
  actions.append(open);
  actions.append(move);
  actions.append(back);
  box.append(name, kind, address, actions);
  return box;
}

function focusLocation(location, afterMove) {
  if (!hasCoordinates(location)) return;
  map.flyTo([Number(location.latitude), Number(location.longitude)], FOCUS_ZOOM, { duration: 0.6 });
  if (afterMove) map.once('moveend', afterMove);
}

function ensureMap(L) {
  if (map) return;
  map = L.map('client-map-canvas', { zoomControl: true, attributionControl: true, minZoom: 5, maxBounds: L.latLngBounds(COLOMBIA_BOUNDS).pad(0.6) });
  markerLayer = L.layerGroup().addTo(map);
  setupBasemaps(L);
  // Si el mapa se creó o encuadró con el panel oculto, recalcula al hacerse visible.
  new ResizeObserver(() => {
    if (!canvasHasSize()) return;
    map.invalidateSize();
    if (pendingFit) fitView(L, pendingFit);
  }).observe($('#client-map-canvas'));
  map.on('click', event => {
    if (!pickClientId || !clients[pickClientId]) return;
    const client = clients[pickClientId];
    // El trabajador también puede ubicar/reubicar (domicilio y dirección alternativa) de su cobro.
    const point = { latitude: event.latlng.lat, longitude: event.latlng.lng, source: isWorkerMap() ? 'trabajador' : 'admin', capturedAt: new Date().toISOString(), by: isWorkerMap() ? state.activeWorker?.name || 'Trabajador' : 'Administrador' };
    const isAlt = pickKind === 'alt';
    if (isAlt) client.altLocation = point; else client.location = point;
    const firstInRoute = !isAlt && !routeEntries(client.route).some(entry => entry.id !== pickClientId && hasCoordinates(entry.client.location));
    persistBusinessData();
    showToast(isAlt ? `Dirección alternativa de ${client.name} guardada.` : `Ubicación de ${client.name} guardada.`);
    const placedId = pickClientId;
    endPick();
    // Recién ubicada, la dirección alternativa se deja visible para confirmar dónde quedó.
    renderClientMap({ refit: firstInRoute }).then(() => { if (isAlt) showAltLocation(placedId); });
  });
}

function setupBasemaps(L) {
  const layers = Object.fromEntries(Object.entries(BASEMAPS).map(([name, build]) => [name, build(L)]));
  let saved = 'Calles';
  try { saved = localStorage.getItem(BASEMAP_STORAGE_KEY) || 'Calles'; } catch { /* preferencia opcional */ }
  (layers[saved] || layers['Calles']).addTo(map);
  L.control.layers(layers, null, { position: 'topright', collapsed: true }).addTo(map);
  map.on('baselayerchange', event => {
    try { localStorage.setItem(BASEMAP_STORAGE_KEY, event.name); } catch { /* preferencia opcional */ }
  });
}

function boundsAround(L, lat, lng, span) {
  return L.latLngBounds([lat - span, lng - span], [lat + span, lng + span]);
}

/**
 * Encuadre del cobro, de lo más preciso a lo más general:
 * 1) clientes ubicados (perímetro mínimo ~1 km), 2) zona guardada del cobro
 * (municipio del trabajador o vista fijada a mano), 3) municipio buscado en línea,
 * 4) departamento, 5) Colombia.
 */
async function resolveFocus(L, { routeId, entries, worker, department }) {
  const located = entries.filter(entry => hasCoordinates(entry.client.location));
  if (located.length === 1) {
    const { client } = located[0];
    return { center: [Number(client.location.latitude), Number(client.location.longitude)], zoom: 15, label: `1 cliente ubicado (${client.name})` };
  }
  if (located.length > 1) {
    const lats = located.map(({ client }) => Number(client.location.latitude));
    const lngs = located.map(({ client }) => Number(client.location.longitude));
    const [south, north, west, east] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const span = Math.max(MIN_SPAN, (north - south) / 2, (east - west) / 2);
    return { bounds: boundsAround(L, (south + north) / 2, (west + east) / 2, span), maxZoom: 16, label: `${located.length} clientes ubicados` };
  }
  const route = routeSettlements[routeId];
  let zone = route?.mapZone;
  if (!zone && worker?.city) {
    zone = await geocodeMunicipality(worker.city, department?.name);
    if (zone && route) { route.mapZone = { ...zone, source: 'municipio' }; persistBusinessData(); }
  }
  if (zone) return { bounds: L.latLngBounds([zone.bbox[0], zone.bbox[1]], [zone.bbox[2], zone.bbox[3]]), maxZoom: 14, label: zone.source === 'manual' ? 'zona fijada para este cobro' : `municipio de ${zone.label}` };
  if (department && worker?.city && worker.city.toLocaleLowerCase('es') === department.capital.toLocaleLowerCase('es')) {
    return { center: department.center, zoom: 12, label: `ciudad de ${department.capital}` };
  }
  if (department) return { bounds: L.latLngBounds([department.bbox[0], department.bbox[1]], [department.bbox[2], department.bbox[3]]), maxZoom: 10, label: `departamento de ${department.name} (no se encontró el municipio: usa "Fijar zona")` };
  return { bounds: L.latLngBounds(COLOMBIA_BOUNDS), maxZoom: 6, label: 'Colombia (el cobro no tiene clientes ubicados ni zona asignada)' };
}

function canvasHasSize() {
  const box = $('#client-map-canvas').getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

async function fitView(L, context) {
  if (!canvasHasSize()) { pendingFit = context; return; } // se reintenta al volverse visible
  pendingFit = null;
  map.invalidateSize();
  const focus = await resolveFocus(L, context);
  if (mapRouteId() !== context.routeId) return;
  if (focus.center) map.setView(focus.center, focus.zoom, { animate: false });
  else map.fitBounds(focus.bounds, { padding: [48, 48], maxZoom: focus.maxZoom, animate: false });
  focusedClientId = null;
  document.querySelectorAll('#client-map-located [data-map-focus]').forEach(row => row.setAttribute('aria-pressed', 'false'));
  $('#client-map-focus').textContent = `Encuadre: ${focus.label}.`;
  lastFitKey = context.routeId;
}

function renderLocatedList(entries) {
  const located = entries.filter(entry => hasCoordinates(entry.client.location));
  $('#client-map-located-count').textContent = String(located.length);
  const list = $('#client-map-located');
  list.replaceChildren();
  if (!located.length) {
    const empty = document.createElement('p');
    empty.className = 'client-map-empty';
    empty.textContent = 'Aún no hay clientes ubicados en este cobro.';
    list.append(empty);
    return;
  }
  located.sort((a, b) => a.client.name.localeCompare(b.client.name, 'es')).forEach(({ id, client, risk }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'client-map-located-row';
    button.dataset.mapFocus = id;
    button.setAttribute('aria-pressed', String(id === focusedClientId));
    const dot = document.createElement('i');
    dot.className = 'client-map-dot';
    dot.style.setProperty('--tier-color', TIER_COLORS[risk.tier]);
    dot.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = client.name;
    button.append(dot, name);
    button.setAttribute('aria-label', `Ver a ${client.name} en el mapa`);
    list.append(button);
  });
}

/** Acerca el mapa a un cliente concreto y abre su ficha rápida. */
function focusClient(clientId) {
  const client = clients[clientId];
  if (!map || !client || !hasCoordinates(client.location)) return;
  const tier = paymentBehavior(client).tier;
  if (!visibleTiers.has(tier)) { // si su color está filtrado, se vuelve a mostrar
    visibleTiers.add(tier);
    const input = document.querySelector(`#client-map-legend input[value="${tier}"]`);
    if (input) input.checked = true;
    renderClientMap({ refit: false }).then(() => focusClient(clientId));
    return;
  }
  focusedClientId = clientId;
  if (shownAltClientId && shownAltClientId !== clientId) hideAltLocation();
  document.querySelectorAll('#client-map-located [data-map-focus]').forEach(row => row.setAttribute('aria-pressed', String(row.dataset.mapFocus === clientId)));
  map.flyTo([Number(client.location.latitude), Number(client.location.longitude)], FOCUS_ZOOM, { duration: 0.6 });
  map.once('moveend', () => markersById.get(clientId)?.openPopup());
  $('#client-map-focus').textContent = `Encuadre: ${client.name}.`;
}

/** Pinta la sección completa. refit=false conserva el encuadre actual (filtros, reubicar). */
export async function renderClientMap({ refit = true } = {}) {
  attachMapHost();
  const routeId = mapRouteId();
  const route = routeSettlements[routeId];
  const worker = workerForRoute(routeId);
  const department = findDepartment(worker?.department);
  $('#client-map-route').textContent = (route?.name || routeId).toLocaleUpperCase('es');
  $('#worker-map-route').textContent = `RUTA ${(route?.name || routeId).toLocaleUpperCase('es')}`;
  $('#client-map-zone').textContent = worker
    ? `${worker.name} · ${worker.city || 'Ciudad sin registrar'}, ${department?.name || 'departamento sin registrar'}`
    : 'Sin trabajador asignado a este cobro';
  const entries = routeEntries(routeId);
  renderSidebar(entries);
  renderLocatedList(entries);

  if (!map) showMessage('Cargando mapa…');
  let L;
  try { L = await loadLeaflet(); }
  catch { showMessage('No se pudo cargar el mapa. Revisa la conexión a internet: la cartografía se descarga en línea.'); return; }
  if (mapRouteId() !== routeId) return; // el usuario cambió de cobro mientras cargaba
  ensureMap(L);
  showMessage(entries.length ? '' : 'Este cobro todavía no tiene clientes.');

  markerLayer.clearLayers();
  markersById.clear();
  hideAltLocation();
  entries.filter(entry => hasCoordinates(entry.client.location) && visibleTiers.has(entry.risk.tier)).forEach(({ id, client, risk }) => {
    const marker = L.circleMarker([Number(client.location.latitude), Number(client.location.longitude)], {
      radius: 9, weight: 2, color: '#FFFFFF', fillColor: TIER_COLORS[risk.tier], fillOpacity: 0.95
    })
      .bindTooltip(client.name, { direction: 'top', offset: [0, -8] })
      .bindPopup(() => popupContent(id, client, risk), { minWidth: 230 })
      .addTo(markerLayer);
    // Al abrir otro cliente, la dirección alternativa que estuviera visible se oculta.
    marker.on('popupopen', () => { if (shownAltClientId && shownAltClientId !== id) hideAltLocation(); });
    markersById.set(id, marker);
  });

  // Leaflet necesita medir el contenedor una vez visible.
  requestAnimationFrame(() => {
    if (canvasHasSize()) map.invalidateSize();
    if (refit || lastFitKey !== routeId) fitView(L, { routeId, entries, worker, department });
  });
}

function startPick(clientId, kind = 'main') {
  const client = clients[clientId];
  if (!client || !map) return;
  pickClientId = clientId;
  pickKind = kind;
  const current = kind === 'alt' ? client.altLocation : client.location;
  if (hasCoordinates(current)) map.flyTo([Number(current.latitude), Number(current.longitude)], FOCUS_ZOOM, { duration: 0.5 });
  $('#client-map-banner-text').textContent = kind === 'alt'
    ? `Haz clic en el mapa sobre la dirección alternativa de ${client.name} (${client.altAddress}).`
    : `Haz clic en el mapa sobre el domicilio de ${client.name}.`;
  $('#client-map-banner').hidden = false;
  $('#client-map-canvas').classList.add('is-picking');
  document.querySelectorAll('#client-map-missing [data-map-pick]').forEach(button => {
    const active = button.dataset.mapPick === clientId;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? 'Ubicando…' : 'Ubicar';
  });
}

function endPick() {
  pickClientId = null;
  pickKind = 'main';
  $('#client-map-banner').hidden = true;
  $('#client-map-canvas').classList.remove('is-picking');
  document.querySelectorAll('#client-map-missing [data-map-pick]').forEach(button => {
    button.classList.remove('is-active');
    button.setAttribute('aria-pressed', 'false');
    button.textContent = 'Ubicar';
  });
}

/** Confirmación breve en el propio botón (✓ + texto) para saber que la acción se ejecutó. */
function flashDone(button, text) {
  const label = button.querySelector('.map-action-label');
  if (!label) return;
  window.clearTimeout(button._doneTimer);
  button.dataset.label ||= label.textContent;
  label.textContent = text;
  button.classList.add('is-done');
  button._doneTimer = window.setTimeout(() => {
    button.classList.remove('is-done');
    label.textContent = button.dataset.label;
  }, 1600);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  $('#client-map-legend').addEventListener('change', event => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;
    if (input.checked) visibleTiers.add(input.value); else visibleTiers.delete(input.value);
    renderClientMap({ refit: false });
  });
  $('#client-map-missing').addEventListener('click', event => {
    const button = event.target.closest('[data-map-pick]');
    if (button) startPick(button.dataset.mapPick);
  });
  $('#client-map-cancel-pick').addEventListener('click', endPick);
  $('#client-map-located').addEventListener('click', event => {
    const button = event.target.closest('[data-map-focus]');
    if (button) focusClient(button.dataset.mapFocus);
  });
  $('#client-map-fit').addEventListener('click', event => {
    renderClientMap({ refit: true });
    flashDone(event.currentTarget, 'Vista centrada');
  });
  $('#client-map-save-zone').addEventListener('click', () => {
    const route = routeSettlements[mapRouteId()];
    if (!map || !route || isWorkerMap()) return;
    const bounds = map.getBounds();
    route.mapZone = { bbox: [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()], label: route.name, source: 'manual' };
    persistBusinessData();
    $('#client-map-focus').textContent = 'Encuadre: zona fijada para este cobro.';
    flashDone($('#client-map-save-zone'), 'Zona guardada');
    showToast(`Zona del cobro ${route.name} guardada. El mapa abrirá aquí mientras no tenga clientes ubicados.`);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && pickClientId && (state.activeAdminPanel === 'map' || state.currentView === 'mapa')) endPick();
  });
}
