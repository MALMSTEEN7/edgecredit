/**
 * features/admin/portfolio-report · Reportes financieros › Cartera.
 *
 * Muestra el dinero que el cobro seleccionado tiene repartido en clientes (saldos de las
 * cartulinas activas, con sus intereses) y, con el botón «Solo clavos», lo que deben los
 * clientes que no abonan hace meses (domain/portfolio.js).
 */

import { routeSelect } from '../../core/dom.js';
import { clients, routeSettlements } from '../../core/store.js';
import { CLAVO_MONTH_OPTIONS, clavoMonths, routePortfolio, setClavoMonths } from '../../domain/portfolio.js';
import { formatDate, formatMoney } from '../../shared/format.js';

const pq = selector => document.querySelector(selector);
let onlyClavos = false;

function monthsLabel(months) {
  return `${months} ${months === 1 ? 'mes' : 'meses'}`;
}

function waitingLabel(days) {
  if (days === null || days === undefined) return '—';
  if (days >= 365) { const years = Math.floor(days / 365); return `${years} año${years === 1 ? '' : 's'}${days % 365 >= 30 ? ` y ${Math.floor((days % 365) / 30)} m` : ''}`; }
  if (days >= 60) return `${Math.floor(days / 30)} meses`;
  return `${days} día${days === 1 ? '' : 's'}`;
}

export function renderPortfolioReport() {
  const panel = pq('[data-report-panel="portfolio"]');
  if (!panel) return;
  const routeId = routeSelect.value;
  const route = routeSettlements[routeId];
  if (!route) return;
  const months = clavoMonths();
  const portfolio = routePortfolio(clients, routeId, { months });
  const view = onlyClavos ? portfolio.clavos : portfolio.all;
  pq('#portfolio-route-name').textContent = String(route.name || routeId).toLocaleUpperCase('es');
  pq('#portfolio-title').textContent = onlyClavos ? 'Lo que deben los clavos' : 'Dinero por recoger';
  panel.dataset.mode = onlyClavos ? 'clavos' : 'all';
  document.querySelectorAll('[data-portfolio-mode]').forEach(button => {
    const active = (button.dataset.portfolioMode === 'clavos') === onlyClavos;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  pq('#portfolio-total-label').textContent = onlyClavos ? 'Total de los clavos' : 'Cartera total (con intereses y clavos)';
  pq('#portfolio-total').textContent = formatMoney(view.balance);
  pq('#portfolio-capital').textContent = formatMoney(view.capital);
  pq('#portfolio-interest').textContent = formatMoney(view.interest);
  pq('#portfolio-count').textContent = `${view.count} ${view.count === 1 ? 'cartulina' : 'cartulinas'}`;
  const share = portfolio.all.balance ? Math.round(portfolio.clavos.balance / portfolio.all.balance * 100) : 0;
  pq('#portfolio-clavos-line').textContent = onlyClavos
    ? `${share}% de la cartera de ${route.name} (${formatMoney(portfolio.all.balance)}) está en clavos: clientes sin abonar hace más de ${monthsLabel(months)}.`
    : `Incluye ${formatMoney(portfolio.clavos.balance)} en ${portfolio.clavos.count} clavo${portfolio.clavos.count === 1 ? '' : 's'} (${share}% de la cartera): sin abonar hace más de ${monthsLabel(months)}.`;
  const select = pq('#portfolio-clavo-months');
  if (select && document.activeElement !== select) select.value = String(months);
  const rows = onlyClavos ? portfolio.rows.filter(row => row.clavo).sort((a, b) => (b.days || 0) - (a.days || 0)) : portfolio.rows;
  const body = pq('#portfolio-body');
  body.replaceChildren(...rows.map(row => {
    const tr = document.createElement('tr');
    tr.classList.toggle('is-clavo', row.clavo);
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = row.client.name;
    if (row.clavo) {
      const tag = document.createElement('span');
      tag.className = 'clavo-tag';
      tag.textContent = 'Clavo';
      name.append(' ', tag);
    }
    const last = document.createElement('td');
    last.textContent = row.last ? `${formatDate(row.last)} · ${waitingLabel(row.days)}` : '—';
    const capital = document.createElement('td');
    capital.className = 'numeric';
    capital.textContent = formatMoney(row.capital);
    const interest = document.createElement('td');
    interest.className = 'numeric';
    interest.textContent = formatMoney(row.interest);
    const balance = document.createElement('td');
    balance.className = 'numeric';
    balance.textContent = formatMoney(row.balance);
    tr.append(name, last, capital, interest, balance);
    return tr;
  }));
  const foot = pq('#portfolio-foot');
  foot.replaceChildren();
  if (rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<th scope="row" colspan="2">Total</th><td class="numeric"></td><td class="numeric"></td><td class="numeric"></td>';
    const cells = tr.querySelectorAll('td');
    cells[0].textContent = formatMoney(view.capital);
    cells[1].textContent = formatMoney(view.interest);
    cells[2].textContent = formatMoney(view.balance);
    foot.append(tr);
  }
  pq('#portfolio-empty').hidden = Boolean(rows.length);
  pq('#portfolio-empty').textContent = onlyClavos ? `No hay clavos: todos los clientes de ${route.name} han abonado en los últimos ${monthsLabel(months)}.` : 'No hay cartulinas activas en este cobro.';
  pq('#portfolio-table-wrap').hidden = !rows.length;
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  const select = pq('#portfolio-clavo-months');
  if (select) {
    select.replaceChildren(...CLAVO_MONTH_OPTIONS.map(months => new Option(`Más de ${monthsLabel(months)} sin abonar`, String(months))));
    select.value = String(clavoMonths());
    select.addEventListener('change', () => { setClavoMonths(Number(select.value)); renderPortfolioReport(); });
  }
  document.querySelectorAll('[data-portfolio-mode]').forEach(button => button.addEventListener('click', () => {
    onlyClavos = button.dataset.portfolioMode === 'clavos';
    renderPortfolioReport();
  }));
  document.querySelector('[data-report-tab="portfolio"]')?.addEventListener('click', renderPortfolioReport);
  routeSelect.addEventListener('change', renderPortfolioReport);
}
