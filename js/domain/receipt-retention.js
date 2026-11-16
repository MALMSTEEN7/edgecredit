/**
 * domain/receipt-retention · Las fotos de comprobantes (transferencias y otros gastos)
 * solo se conservan RECEIPT_RETENTION_HOURS horas. Después se borra la imagen y queda
 * el registro con `receiptPurgedAt`, para que no aparezca como «sin comprobante».
 *
 * Motivo: las fotos viajan dentro del registro del cliente o de la ruta y cada cambio
 * las vuelve a descargar en todos los equipos (egress de Supabase).
 */

import { clients, persistBusinessData, routeSettlements } from '../core/store.js';

export const RECEIPT_RETENTION_HOURS = 24;
const RETENTION_MS = RECEIPT_RETENTION_HOURS * 60 * 60 * 1000;

/** Momento en que se tomó el comprobante; si no hay hora, el final del día del registro. */
function receiptTakenAt(item) {
  const stamp = Date.parse(item.at || item.createdAt || '');
  if (Number.isFinite(stamp)) return stamp;
  const day = Date.parse(`${item.date}T23:59:59`);
  return Number.isFinite(day) ? day : NaN;
}

function purgeItem(item, now) {
  if (!item?.receiptData) return false;
  const taken = receiptTakenAt(item);
  if (!Number.isFinite(taken) || now - taken < RETENTION_MS) return false;
  item.receiptData = '';
  item.receiptPurgedAt = new Date(now).toISOString();
  return true;
}

/** Función pura (se prueba sin DOM): borra las fotos vencidas y dice si cambió algo. */
export function purgeReceipts(clientMap, routeMap, now = Date.now()) {
  let changed = false;
  Object.values(clientMap || {}).forEach(client => {
    (client.payments || []).forEach(payment => { if (purgeItem(payment, now)) changed = true; });
  });
  Object.values(routeMap || {}).forEach(route => {
    (route.otherExpenseEntries || []).forEach(entry => { if (purgeItem(entry, now)) changed = true; });
  });
  return changed;
}

export function purgeExpiredReceipts() {
  if (purgeReceipts(clients, routeSettlements)) persistBusinessData();
}

/** Texto para un comprobante que ya se borró por la regla de 24 horas. */
export function purgedReceiptLabel() {
  return `Foto borrada (${RECEIPT_RETENTION_HOURS} h)`;
}
