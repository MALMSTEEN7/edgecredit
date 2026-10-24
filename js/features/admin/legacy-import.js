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
import { convertLegacyExport } from '../../domain/legacy-import.js';
import { escapeHTML, formatMoney, routeKey } from '../../shared/format.js';
import { paymentFrequencyLabels } from '../../core/config.js';
import { showToast } from '../../ui/toast.js';
import { renderAdminRoute } from './admin-shell.js';
import { appendClientCards, filterClientCards, renderClientRows } from '../clients/directory.js';

let legacyRaw = null;
let legacyFileName = '';

const legacyPreview = () => document.querySelector('#legacy-import-preview');

function closeLegacyPreview() {
  legacyRaw = null;
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
  const result = convertLegacyExport(legacyRaw, routeId);
  const existing = result.cards.filter(card => clients[card.clientId]);
  const fresh = result.cards.filter(card => !clients[card.clientId]);
  const warningCount = result.cards.reduce((sum, card) => sum + card.warnings.length, 0);
  const rows = result.cards.map(({ code, clientId, client, warnings }) => `
    <tr${clients[clientId] ? ' class="is-existing"' : ''}>
      <td><strong>${escapeHTML(code)}</strong><small>${escapeHTML(client.name)}</small></td>
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
  box.querySelector('#legacy-import-confirm').addEventListener('click', () => importLegacyCards(fresh, routeSettlements[routeId]?.name || routeId));
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

async function readLegacyFile(file) {
  if (!file) return;
  try {
    const text = (await file.text()).replace(/^﻿/, '');
    legacyRaw = JSON.parse(text);
    legacyFileName = file.name;
    renderLegacyPreview();
  } catch (error) {
    closeLegacyPreview();
    showToast(error instanceof SyntaxError ? 'El archivo no es un JSON válido.' : error.message || 'No se pudo leer el archivo.');
  }
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  const input = document.querySelector('#legacy-import-file');
  document.querySelector('#legacy-import-open').addEventListener('click', () => input.click());
  input.addEventListener('change', () => readLegacyFile(input.files?.[0]));
  legacyPreview().addEventListener('click', event => { if (event.target.closest('[data-legacy-cancel]')) closeLegacyPreview(); });
}
