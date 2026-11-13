/**
 * features/admin/backup · Respaldo completo del sistema en un solo archivo .json.
 *
 * Con servidor (Supabase) descarga directamente de la base de datos todo lo que el admin ve
 * (RLS: el admin ve todo), en páginas de 1.000 filas, y lo agrupa por cobro:
 *   { app, tipo, version, generado, fuente, resumen, cobros: [{ id, nombre, ruta, estado,
 *     clientes, solicitudes, recorridos }], sinCobro, usuarios, ajustes }
 * Cada fila conserva su forma original (id, route_id, data, updated_at) para poder
 * restaurarla tal cual. Solo lee: no modifica nada en la base de datos.
 *
 * Sin servidor (modo local) exporta los datos de negocio de este navegador.
 * Nunca incluye contraseñas, secretos del autenticador ni claves de recuperación.
 *
 * Al terminar ofrece «Descargar» y, si el dispositivo lo permite (celulares), «Compartir»,
 * que abre el menú del sistema para enviarlo directo a Google Drive, WhatsApp, correo, etc.
 */

import { backend, backendEnabled, backendErrorMessage } from '../../core/backend.js';
import { clients, pendingRequests, personnel, routeSettlements, shared } from '../../core/store.js';
import { state } from '../../core/state.js';
import { openCustomModal } from '../../ui/custom-modal.js';
import { showToast } from '../../ui/toast.js';

const PAGE = 1000;
const BACKUP_TABLES = [
  { table: 'routes', order: 'id' },
  { table: 'route_state', order: 'route_id' },
  { table: 'clients', order: 'id' },
  { table: 'pending_requests', order: 'id' },
  { table: 'worker_positions', order: 'id', optional: true }, // recorridos GPS (supabase/recorridos.sql)
  { table: 'profiles', order: 'user_id' },
  { table: 'app_settings', order: 'key' },
];

let running = false;

async function fetchAll(db, table, order, onProgress) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select('*').order(order, { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(backendErrorMessage(error));
    rows.push(...(data || []));
    onProgress?.(rows.length);
    if (!data || data.length < PAGE) return rows;
  }
}

function emptyCobro(id, nombre = id) {
  return { id, nombre, ruta: null, estado: null, clientes: [], solicitudes: [], recorridos: [] };
}

async function serverBackup(onProgress) {
  const db = await backend();
  const raw = {};
  for (const { table, order, optional } of BACKUP_TABLES) {
    try {
      raw[table] = await fetchAll(db, table, order, count => onProgress(`${table}: ${count.toLocaleString('es-CO')} filas`));
    } catch (error) {
      if (!optional) throw error;
      raw[table] = [];
    }
  }
  const cobros = new Map();
  raw.routes.forEach(row => {
    const cobro = emptyCobro(row.id, row.data?.name || row.id);
    cobro.ruta = row;
    cobros.set(row.id, cobro);
  });
  const sinCobro = emptyCobro('', 'Sin cobro asignado');
  const cobroDe = routeId => cobros.get(routeId) || sinCobro;
  raw.route_state.forEach(row => { cobroDe(row.route_id).estado = row; });
  raw.clients.forEach(row => cobroDe(row.route_id).clientes.push(row));
  raw.pending_requests.forEach(row => cobroDe(row.route_id).solicitudes.push(row));
  raw.worker_positions.forEach(row => cobroDe(row.route_id).recorridos.push(row));
  const lista = [...cobros.values()].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const huerfanos = sinCobro.estado || sinCobro.clientes.length || sinCobro.solicitudes.length || sinCobro.recorridos.length;
  return {
    fuente: 'servidor',
    resumen: {
      cobros: lista.length,
      clientes: raw.clients.length,
      solicitudes: raw.pending_requests.length,
      posicionesGps: raw.worker_positions.length,
      usuarios: raw.profiles.length,
    },
    cobros: lista,
    sinCobro: huerfanos ? sinCobro : null,
    usuarios: raw.profiles,
    ajustes: raw.app_settings,
  };
}

function localBackup() {
  const lista = Object.entries(routeSettlements).map(([id, ruta]) => ({
    ...emptyCobro(id, ruta?.name || id),
    ruta,
    estado: {
      dailyRouteOrder: state.dailyRouteOrder[id] || [],
      dailyRouteDate: state.dailyRouteDates[id] || '',
      clientLibraryOrder: state.clientLibraryOrder[id] || [],
    },
    clientes: Object.entries(clients).filter(([, client]) => client?.route === id).map(([key, data]) => ({ id: key, data })),
    solicitudes: pendingRequests.filter(request => request?.routeId === id),
  }));
  return {
    fuente: 'local',
    resumen: { cobros: lista.length, clientes: Object.keys(clients).length, solicitudes: pendingRequests.length, usuarios: personnel.length },
    cobros: lista,
    todosLosClientes: clients,
    usuarios: personnel,
    ajustes: { shared },
  };
}

function fileName(date) {
  const pad = value => String(value).padStart(2, '0');
  return `respaldo-edgecredit-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}

function sizeLabel(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const count = (n, word) => `${Number(n || 0).toLocaleString('es-CO')} ${word}${n === 1 ? '' : 's'}`;

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function canShareFile(file) {
  try { return Boolean(navigator.canShare?.({ files: [file] })); } catch { return false; }
}

function offerBackup(payload) {
  const now = new Date();
  const name = fileName(now);
  const text = JSON.stringify({ app: 'EdgeCredit', tipo: 'respaldo-completo', version: 1, generado: now.toISOString(), ...payload });
  const file = new File([text], name, { type: 'application/json' });
  const shareable = canShareFile(file);
  const r = payload.resumen;
  openCustomModal({
    title: 'Respaldo listo',
    description: `${count(r.cobros, 'cobro')} · ${count(r.clientes, 'cliente')} · ${count(r.usuarios, 'usuario')} · ${sizeLabel(file.size)}. `
      + 'El archivo tiene cédulas, teléfonos y direcciones: guárdalo en un lugar seguro y no lo compartas.'
      + (shareable ? ' Con «Compartir» puedes enviarlo directo a Google Drive.' : ''),
    submitLabel: 'Descargar',
    cancelLabel: shareable ? 'Compartir / Drive' : 'Cerrar',
    onSubmit: () => {
      download(file, name);
      showToast(`Respaldo descargado: ${name}`);
    },
    onCancel: shareable ? () => {
      navigator.share({ files: [file], title: name }).then(
        () => showToast('Respaldo enviado.'),
        error => { if (error?.name !== 'AbortError') showToast('No se pudo compartir; usa «Descargar».'); },
      );
      return false;
    } : null,
  });
}

async function createBackup() {
  if (running) return;
  running = true;
  const button = document.querySelector('#admin-backup');
  const status = document.querySelector('#admin-backup-status');
  const previous = status?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Generando…'; }
  try {
    const payload = backendEnabled()
      ? await serverBackup(message => { if (status) status.textContent = `Descargando ${message}…`; })
      : localBackup();
    offerBackup(payload);
  } catch (error) {
    showToast(`No se pudo generar el respaldo: ${error.message || error}`);
  } finally {
    running = false;
    if (button) { button.disabled = false; button.textContent = 'Generar'; }
    if (status && previous) status.textContent = previous;
  }
}

/** Registra los listeners del módulo. Se invoca una sola vez desde app.js. */
export function mount() {
  document.querySelector('#admin-backup')?.addEventListener('click', createBackup);
}
