/**
 * core/backend · Cliente de Supabase (base de datos y autenticación en la nube).
 * Si no hay URL/clave configuradas, `backendEnabled()` es false y la app usa el modo local.
 */

import { AUTH_EMAIL_DOMAIN, SUPABASE_ANON_KEY, SUPABASE_JS_URL, SUPABASE_URL } from './backend-config.js';

// Permite inyectar otra conexión sin tocar el código (pruebas automáticas).
const override = globalThis.EDGECREDIT_BACKEND || {};
const BACKEND_URL = override.url || SUPABASE_URL;
const BACKEND_KEY = override.key || SUPABASE_ANON_KEY;

let client = null;
let loading = null;

export function backendEnabled() {
  return Boolean(BACKEND_URL && BACKEND_KEY);
}

function loadLibrary() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SUPABASE_JS_URL;
    script.async = true;
    script.onload = () => (window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('No se pudo iniciar la conexión con el servidor.')));
    script.onerror = () => { loading = null; reject(new Error('Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.')); };
    document.head.append(script);
  });
  return loading;
}

/** Cliente principal (sesión del usuario que inició sesión). */
export async function backend() {
  if (client) return client;
  const lib = await loadLibrary();
  client = lib.createClient(BACKEND_URL, BACKEND_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'edgecredit-auth' },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}

export function usernameToEmail(username) {
  const clean = String(username || '').trim().toLocaleLowerCase('es');
  return clean.includes('@') ? clean : `${clean}@${AUTH_EMAIL_DOMAIN}`;
}

/** Mensaje entendible para errores de red o del servidor. */
export function backendErrorMessage(error, fallback = 'No se pudo completar la operación en el servidor.') {
  const text = String(error?.message || error || '');
  if (/fetch|network|Failed to/i.test(text)) return 'Sin conexión con el servidor. Revisa tu internet.';
  if (/row-level security|permission denied/i.test(text)) return 'El servidor no permitió la operación (permisos, horario o acceso desactivado).';
  return text || fallback;
}
