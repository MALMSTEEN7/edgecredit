/**
 * core/backend-config · Conexión con el servidor (Supabase).
 *
 * Con estos dos valores vacíos la app funciona como antes: cada dispositivo guarda sus
 * datos solo en su navegador (útil para pruebas individuales).
 *
 * Para trabajar en equipo lo normal es llenar config.js (raíz del proyecto), que tiene
 * prioridad y no requiere recompilar. Alternativamente copia aquí los
 * datos de tu proyecto: Supabase → Project Settings → API:
 *   - SUPABASE_URL      → «Project URL»   (https://xxxx.supabase.co)
 *   - SUPABASE_ANON_KEY → «anon public»   (es pública por diseño: la seguridad la
 *                                          hacen las reglas RLS de supabase/schema.sql)
 * NUNCA pongas aquí la clave «service_role».
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

/** Los usuarios entran con un nombre corto (camila); por dentro Supabase usa camila@<dominio>. */
export const AUTH_EMAIL_DOMAIN = 'edgecredit.app';

/** Librería oficial de Supabase (se descarga al iniciar sesión). */
export const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
