/**
 * ui/back-navigation · Botón «atrás» del celular (y del navegador).
 *
 * Cada pantalla, panel del admin o ventana modal que se abre agrega una entrada al
 * historial (`history.pushState`); al pulsar atrás (`popstate`) se cierra la modal de
 * encima o se vuelve a la pantalla anterior. En la pantalla de inicio el primer atrás
 * avisa «Pulsa atrás otra vez para salir» y solo un segundo atrás dentro de 2 s cierra la app.
 *
 * No hace falta tocar cada módulo: se observa la interfaz (atributo `hidden` y clases) y el
 * historial se ajusta a lo que está abierto. Cerrar algo con su botón (×, Cancelar, Escape)
 * retira su entrada sin que se note.
 *
 * Historial de una sesión: [0 · centinela] [1 · inicio] [2…n · una capa por pantalla o modal].
 */

import { adminView, loginGateway, workerView } from '../core/dom.js';
import { state } from '../core/state.js';
import { defaultAdminPanel, enterAdminDirectory, showAdminPanel } from '../features/admin/admin-shell.js';
import { openClient } from '../features/clients/client-detail.js';
import { showView } from './navigation.js';
import { showToast } from './toast.js';

const EXIT_WINDOW_MS = 2000;

/** Ventanas que se cierran con atrás: cómo saber si están abiertas y con qué botón se cierran. */
const BACK_MODALS = [
  { key: 'admin-menu', isOpen: () => document.body.classList.contains('admin-menu-open'), close: '#admin-menu-close' },
  { key: 'payment', isOpen: () => !document.querySelector('#payment-modal')?.hidden, close: '[data-close-payment]' },
  { key: 'interest', isOpen: () => !document.querySelector('#interest-modal')?.hidden, close: '[data-close-interest]' },
  { key: 'new-client', isOpen: () => !document.querySelector('#new-client-modal')?.hidden, close: '#new-client-close' },
  { key: 'worker-expense', isOpen: () => !document.querySelector('#worker-expense-modal')?.hidden, close: '#close-worker-expense' },
  { key: 'operations-list', isOpen: () => !document.querySelector('#operations-list-modal')?.hidden, close: '[data-close-operations-list]' },
  { key: 'custom', isOpen: () => !document.querySelector('#custom-modal')?.hidden, close: '#custom-modal-close' },
  { key: 'image-viewer', isOpen: () => !document.querySelector('#image-viewer')?.hidden, close: '#image-viewer-close' },
];

const navSession = Math.random().toString(36).slice(2); // distingue las entradas de esta carga de la página
let navActive = false;
let navLayers = [];          // [{ type: 'screen', snap } | { type: 'modal', modal }]
let navEntry = 0;            // entrada del historial en la que estamos (0 centinela, 1 inicio…)
let navScreen = null;        // { key, snap } pantalla actual
let navSilent = 0;           // popstate propios por ignorar (retrocesos hechos por la app)
let navSilentTimer = null;
let navQueue = [];           // operaciones de historial en espera de un retroceso propio
let navRestoring = false;
let exitArmed = false;
let exitTimer = null;

// ── Pantalla actual ──

function currentScreen() {
  if (!loginGateway.hidden || (workerView.hidden && adminView.hidden)) return null;
  if (!adminView.hidden) return { mode: 'admin', panel: state.activeAdminPanel };
  const mode = document.body.classList.contains('admin-client-mode') ? 'admin-client' : 'worker';
  return { mode, view: state.currentView, client: state.currentView === 'detalle-cliente' ? state.activeClient : null };
}

// La ficha del cliente es una sola pantalla aunque se pase a la cartulina siguiente.
const screenKey = snap => `${snap.mode}:${snap.panel || snap.view}`;
const isHomeScreen = snap => (snap.mode === 'worker' && snap.view === 'inicio') || (snap.mode === 'admin' && snap.panel === defaultAdminPanel());

function restoreScreen(snap) {
  if (snap.mode === 'admin') {
    if (adminView.hidden) document.querySelector('#admin-directory-back')?.click();
    showAdminPanel(snap.panel);
    return;
  }
  if (snap.mode === 'admin-client' && !document.body.classList.contains('admin-client-mode')) enterAdminDirectory();
  if (snap.view === 'detalle-cliente' && snap.client) openClient(snap.client);
  else showView(snap.view);
}

// ── Historial ──

function runHistory(operation) {
  if (navSilent > 0) navQueue.push(operation);
  else operation();
}

function pushEntry(depth) {
  runHistory(() => history.pushState({ edgecredit: navSession, depth }, ''));
}

/** Retrocede n entradas sin tratarlo como un «atrás» de la persona. */
function goBackSilently(steps) {
  if (steps <= 0) return;
  runHistory(() => {
    navSilent += 1;
    window.clearTimeout(navSilentTimer);
    // Por si el navegador no avisa (no debería): no se queda esperando para siempre.
    navSilentTimer = window.setTimeout(() => { navSilent = 0; drainQueue(); }, 1000);
    history.go(-steps);
  });
}

function drainQueue() {
  const pending = navQueue;
  navQueue = [];
  pending.forEach(operation => runHistory(operation));
}

function disarmExit() {
  exitArmed = false;
  window.clearTimeout(exitTimer);
}

function start(snap) {
  navActive = true;
  navLayers = [];
  navScreen = { key: screenKey(snap), snap };
  runHistory(() => history.replaceState({ edgecredit: navSession, depth: 0 }, ''));
  pushEntry(1);
  navEntry = 1;
}

function stop() {
  disarmExit();
  goBackSilently(navEntry);
  navActive = false;
  navLayers = [];
  navEntry = 0;
  navScreen = null;
}

/** Ajusta las capas del historial a lo que está abierto en pantalla. */
function reconcile() {
  if (navRestoring) return;
  const snap = currentScreen();
  if (!snap) { if (navActive) stop(); return; }
  if (!navActive) { start(snap); return; }
  const before = navLayers.length;
  const added = [];
  // Modales cerradas con su botón, Escape o al guardar: se retira su entrada.
  navLayers = navLayers.filter(layer => layer.type !== 'modal' || layer.modal.isOpen());
  const key = screenKey(snap);
  if (key !== navScreen.key) {
    // Volver al inicio por el menú limpia el camino: el siguiente atrás ofrece salir.
    if (isHomeScreen(snap)) navLayers = navLayers.filter(layer => layer.type !== 'screen');
    else added.push({ type: 'screen', snap: navScreen.snap });
    navScreen = { key, snap };
  } else navScreen.snap = snap;
  BACK_MODALS.forEach(modal => {
    if (modal.isOpen() && !navLayers.some(layer => layer.modal === modal)) added.push({ type: 'modal', modal });
  });
  const removed = before - navLayers.length;
  if (!removed && !added.length) return;
  goBackSilently(removed);
  if (added.length && navEntry === 0) { disarmExit(); pushEntry(1); }
  added.forEach(layer => { navLayers.push(layer); pushEntry(navLayers.length + 1); });
  navEntry = navLayers.length + 1;
}

function closeLayer(layer) {
  if (layer.type === 'modal') document.querySelector(layer.modal.close)?.click();
  else restoreScreen(layer.snap);
}

/** Primer atrás en el inicio: avisa; si en 2 s no hay otro, se vuelve a dejar la entrada del inicio. */
function askToExit() {
  disarmExit();
  exitArmed = true;
  showToast('Pulsa atrás otra vez para salir');
  exitTimer = window.setTimeout(() => {
    exitArmed = false;
    if (navActive && navEntry === 0) { pushEntry(1); navEntry = 1; }
  }, EXIT_WINDOW_MS);
}

function onPopState(event) {
  if (navSilent > 0) {
    navSilent -= 1;
    if (!navSilent) { window.clearTimeout(navSilentTimer); drainQueue(); }
    return;
  }
  if (!navActive) return;
  const target = event.state?.edgecredit === navSession ? Number(event.state.depth) || 0 : -1;
  if (target < 0) {
    // Entrada de antes (p. ej. de una carga anterior de la página): la persona quiere salir.
    if (exitArmed) history.back();
    else { askToExit(); navEntry = 0; }
    return;
  }
  const current = navLayers.length + 1;
  if (target > current) { goBackSilently(target - current); return; } // «adelante»: se ignora
  navRestoring = true;
  try {
    while (navLayers.length + 1 > Math.max(target, 1)) closeLayer(navLayers.pop());
  } finally {
    navRestoring = false;
  }
  const snap = currentScreen();
  if (snap) navScreen = { key: screenKey(snap), snap };
  navEntry = target;
  if (target === 0) askToExit();
  // Si algo no se dejó cerrar (p. ej. pide confirmación), vuelve a tener su entrada.
  queueMicrotask(reconcile);
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  window.addEventListener('popstate', onPopState);
  new MutationObserver(reconcile).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
}
