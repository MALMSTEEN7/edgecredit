/*
 * EdgeCredit · configuración del servidor (se edita sin recompilar nada).
 *
 * Vacío  → la app funciona sola en cada dispositivo (datos solo en ese navegador).
 * Lleno  → todos (administrador y trabajadores) comparten los mismos datos en Supabase.
 *
 * Dónde sacar los valores: Supabase → Project Settings → API
 *   url → «Project URL»          (https://xxxx.supabase.co)
 *   key → «anon public» key      (es pública por diseño; la seguridad la ponen
 *                                 las reglas de supabase/schema.sql)
 *
 * NUNCA pongas aquí la clave «service_role»: daría control total de la base de datos.
 */
window.EDGECREDIT_BACKEND = window.EDGECREDIT_BACKEND || {
  url: 'https://pyrcflxjbrxrjhwlcbaj.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cmNmbHhqYnJ4cmpod2xjYmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNTgxNDEsImV4cCI6MjEwNjgzNDE0MX0.kb57MYE3BNtVPbfJHKM9iLIH2SW0aF3f_1CGBxlMjzs',
};
