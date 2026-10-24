/**
 * features/admin/legacy-import · «Importar cartera del sistema anterior» (Configuración del admin).
 *
 * El admin elige el .json que genera tools/migracion/exportar-cobro.ps1 y el cobro de destino;
 * ve el resumen (créditos, capital, saldos, abonos y datos por corregir) y solo al confirmar
 * se crean las cartulinas. Las que ya se importaron antes no se tocan, así no se pierden
 * abonos registrados después en EdgeCredit. No mueve la caja ni la liquidación de hoy.
 */

import { routeSelect } from '../../core/dom.js';
import { clients, persistBusinessData, routeSettlements } from '../../core/store.js';
import { convertLegacyExport, legacyCorrections } from '../../domain/legacy-import.js';
import { escapeHTML, formatMoney, routeKey } from '../../shared/format.js';
import { paymentFrequencyLabels } from '../../core/config.js';
import { showToast } from '../../ui/toast.js';
import { renderAdminRoute } from './admin-shell.js';
import { appendClientCards, filterClientCards, renderClientRows } from '../clients/directory.js';

let legacyRaw = null;
let legacyFileName = '';
// Nombre limpio y referencia por crédito: del archivo de correcciones y de lo que el admin escriba.
let legacyNames = {};

const legacyPreview = () => document.querySelector('#legacy-import-preview');

function closeLegacyPreview() {
  legacyRaw = null;
  legacyNames = {};
  legacyPreview().hidden = true;
  legacyPreview().innerHTML = '';
  document.querySelector('#legacy-import-file').value = '';
}

function renderLegacyPreview() {
  const box = legacyPreview();
  const routes = Object.entries(routeSettlements);
  if (!routes.length) {
    box.innerHTML = '<p class="legacy-import-error">Primero crea el cobro: registra a su trabajador en Gestión de Personal con esa ruta.</p><div class="legacy-import-actions"><button class="secondary-button" type="button" data-legacy-cancel>Cerrar</button></div>';
    box.hidden = false;
    return;
  }
  const chosen = box.querySelector('#legacy-import-route')?.value;
  const guess = routeKey(String(legacyRaw.cobro?.COB_CODIGO || ''));
  const routeId = routeSettlements[chosen] ? chosen : routeSettlements[guess] ? guess : routeSelect.value || routes[0][0];
  const result = convertLegacyExport(legacyRaw, routeId, undefined, legacyNames);
  const existing = result.cards.filter(card => clients[card.clientId]);
  const fresh = result.cards.filter(card => !clients[card.clientId]);
  const warningCount = result.cards.reduce((sum, card) => sum + card.warnings.length, 0);
  const rows = result.cards.map(({ code, clientId, client, warnings, legacyName, reference }) => `
    <tr${clients[clientId] ? ' class="is-existing"' : ''}>
      <td class="legacy-name-cell"><strong>${escapeHTML(code)}</strong>
        <input class="legacy-name-input" type="text" data-legacy-code="${escapeHTML(code)}" value="${escapeHTML(client.name)}" aria-label="Nombre del cliente del crédito ${escapeHTML(code)}" maxlength="80">
        ${client.name !== legacyName ? `<small>Sistema: ${escapeHTML(legacyName)}</small>` : ''}${reference ? `<small>Referencia: ${escapeHTML(reference)}</small>` : ''}</td>
      <td>${formatMoney(client.principal)}</td>
      <td>${formatMoney(client.total)}</td>
      <td>${escapeHTML(paymentFrequencyLabels[client.frequency])} · ${client.installments} × ${formatMoney(client.installment)}</td>
      <td>${client.payments.length}</td>
      <td><strong>${formatMoney(client.balance)}</strong></td>
      <td>${clients[clientId] ? '<span class="legacy-tag">Ya importado</span>' : ''}${client.paymentWarning ? '<span class="legacy-tag is-alert">CLAVO</span>' : ''}${warnings.map(text => `<small class="legacy-warning">${escapeHTML(text)}</small>`).join('')}</td>
    </tr>`).join('');
  const rejected = result.rejected.map(item => `<li><strong>${escapeHTML(item.code)}</strong>: ${escapeHTML(item.error)}</li>`).join('');
  box.innerHTML = `
    <header class="legacy-import-head">
      <div><p class="eyebrow">VISTA PREVIA · ${escapeHTML(legacyFileName)}</p><h3>Cobro ${escapeHTML(result.cobro || 'sin nombre')}${result.worker ? ` · ${escapeHTML(result.worker)}` : ''}</h3></div>
      <div class="legacy-import-tools"><button class="secondary-button" type="button" id="legacy-names-open">Cargar nombres corregidos</button><input type="file" id="legacy-names-file" accept=".json,application/json" hidden></div>
      <label class="legacy-import-route">Cargar en el cobro<select id="legacy-import-route" class="route-select">${routes.map(([id, route]) => `<option value="${escapeHTML(id)}"${id === routeId ? ' selected' : ''}>${escapeHTML(route.name || id)}</option>`).join('')}</select></label>
    </header>
    <dl class="legacy-import-totals">
      <div><dt>Créditos</dt><dd>${result.totals.count}</dd></div>
      <div><dt>Personas</dt><dd>${result.totals.people}</dd></div>
      <div><dt>Capital prestado</dt><dd>${formatMoney(result.totals.principal)}</dd></div>
      <div><dt>Abonado (${result.totals.payments} abonos)</dt><dd>${formatMoney(result.totals.paid)}</dd></div>
      <div><dt>Saldo pendiente</dt><dd>${formatMoney(result.totals.balance)}</dd></div>
      <div><dt>Datos por revisar</dt><dd>${warningCount}</dd></div>
    </dl>
    <p class="legacy-import-note">Puedes corregir el nombre de cada cliente en la tabla. El nombre del sistema anterior y la referencia quedan en las notas del cliente.</p>
    <p class="legacy-import-note">Los abonos entran como efectivo y el seguro (10 %) como cobrado en el sistema anterior. Nada de esto suma a la caja ni a la liquidación de hoy.</p>
    ${rejected ? `<div class="legacy-import-error"><strong>No se importan:</strong><ul>${rejected}</ul></div>` : ''}
    <div class="legacy-import-table-wrap"><table class="legacy-import-table">
      <thead><tr><th>Crédito / cliente</th><th>Capital</th><th>Total</th><th>Cuotas</th><th>Abonos</th><th>Saldo</th><th>Observaciones</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${existing.length ? `<p class="legacy-import-note">${existing.length} crédito(s) ya estaban importados y no se modificarán.</p>` : ''}
    <div class="legacy-import-actions">
      <button class="secondary-button" type="button" data-legacy-cancel>Cancelar</button>
      <button class="primary-button" type="button" id="legacy-import-confirm"${fresh.length ? '' : ' disabled'}>Importar ${fresh.length} crédito(s) <span aria-hidden="true">→</span></button>
    </div>`;
  box.hidden = false;
  box.querySelector('#legacy-import-route').addEventListener('change', renderLegacyPreview);
  // Solo se guarda lo escrito (sin repintar): repintar a mitad de un clic se tragaría el clic en «Importar».
  box.querySelectorAll('.legacy-name-input').forEach(input => input.addEventListener('input', () => {
    const code = input.dataset.legacyCode;
    legacyNames[code] = { ...legacyNames[code], name: input.value.trim() };
  }));
  const namesFile = box.querySelector('#legacy-names-file');
  box.querySelector('#legacy-names-open').addEventListener('click', () => namesFile.click());
  namesFile.addEventListener('change', () => readLegacyNames(namesFile.files?.[0]));
  box.querySelector('#legacy-import-confirm').addEventListener('click', () => {
    // Se convierte otra vez con los nombres que haya en pantalla en este momento.
    const latest = convertLegacyExport(legacyRaw, routeId, undefined, legacyNames).cards.filter(card => !clients[card.clientId]);
    importLegacyCards(latest, routeSettlements[routeId]?.name || routeId);
  });
}

/** Archivo de correcciones de nombres: rellena los nombres limpios y las referencias. */
async function readLegacyNames(file) {
  if (!file) return;
  try {
    const loaded = legacyCorrections(JSON.parse((await legacyFileText(file)).replace(/^\uFEFF/, '')));
    legacyNames = { ...legacyNames, ...loaded };
    renderLegacyPreview();
    const known = new Set((legacyRaw?.tarjetas || []).map(card => String(card?.TAR_CODIGO || '').trim().toUpperCase()));
    const matched = Object.keys(loaded).filter(code => known.has(code)).length;
    showToast(`Nombres corregidos: ${matched} de ${Object.keys(loaded).length} coinciden con este cobro.`);
  } catch (error) {
    showToast(error instanceof SyntaxError ? 'El archivo de nombres no es un JSON válido.' : error.message || 'No se pudo leer el archivo de nombres.');
  }
}

function importLegacyCards(cards, routeName) {
  cards.forEach(({ clientId, client }) => {
    if (clients[clientId]) return;
    clients[clientId] = client;
    appendClientCards(clientId);
    renderClientRows(clientId);
  });
  persistBusinessData();
  filterClientCards();
  if (routeSettlements[routeSelect.value]) renderAdminRoute(routeSelect.value);
  closeLegacyPreview();
  showToast(`Se importaron ${cards.length} crédito(s) al cobro ${routeName}.`);
}

/**
 * Texto del archivo según su codificación real. El script lo escribe en UTF-8, pero si el
 * archivo se abre y se vuelve a guardar en Windows (Bloc de notas, «>» en la consola) puede
 * quedar en UTF-16 o en ANSI, y leído como UTF-8 deja de ser un JSON válido.
 */
async function legacyFileText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decode = (encoding, start = 0, fatal = false) => new TextDecoder(encoding, { fatal }).decode(bytes.subarray(start));
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return decode('utf-8', 3);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return decode('utf-16le', 2);
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return decode('utf-16be', 2);
  if (bytes.length > 1 && bytes[1] === 0 && bytes[0] !== 0) return decode('utf-16le');
  if (bytes.length > 1 && bytes[0] === 0 && bytes[1] !== 0) return decode('utf-16be');
  try { return decode('utf-8', 0, true); } catch { return decode('windows-1252'); }
}

/** Error de lectura en la vista previa (queda en pantalla para poder leerlo o fotografiarlo). */
function showLegacyError(message, detail = '') {
  legacyRaw = null;
  const box = legacyPreview();
  box.innerHTML = `<div class="legacy-import-error"><strong>${escapeHTML(message)}</strong>${detail ? `<p>${escapeHTML(detail)}</p>` : ''}</div><div class="legacy-import-actions"><button class="secondary-button" type="button" data-legacy-cancel>Cerrar</button></div>`;
  box.hidden = false;
  document.querySelector('#legacy-import-file').value = '';
}

async function readLegacyFile(file) {
  if (!file) return;
  let text = '';
  try {
    text = (await legacyFileText(file)).replace(/^\uFEFF/, '').trim();
  } catch (error) {
    showLegacyError('No se pudo leer el archivo.', error.message || '');
    return;
  }
  try {
    legacyRaw = JSON.parse(text);
  } catch (error) {
    const start = text.slice(0, 1);
    const hint = !text ? 'El archivo está vacío.'
      : start !== '{' ? `El archivo no empieza como una exportación (empieza con «${start}»). Revisa que elegiste el archivo «…-edgecredit.json» y no otro.`
      : 'El archivo parece cortado o modificado. Vuelve a exportarlo con el script y súbelo sin abrirlo antes.';
    showLegacyError(`«${file.name}» no es un JSON válido (${(file.size / 1024).toFixed(1)} KB).`, `${hint} Detalle técnico: ${error.message}`);
    return;
  }
  try {
    legacyFileName = file.name;
    renderLegacyPreview();
  } catch (error) {
    showLegacyError('No se pudo preparar la vista previa.', error.message || String(error));
  }
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  const input = document.querySelector('#legacy-import-file');
  document.querySelector('#legacy-import-open').addEventListener('click', () => input.click());
  input.addEventListener('change', () => readLegacyFile(input.files?.[0]));
  legacyPreview().addEventListener('click', event => { if (event.target.closest('[data-legacy-cancel]')) closeLegacyPreview(); });
}
