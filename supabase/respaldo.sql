-- EdgeCredit · Respaldo automático semanal (Google Apps Script → Google Drive).
--
-- Un script en la cuenta de Google del dueño llama cada domingo a
--   POST /rest/v1/rpc/backup_snapshot  { "secret": "<clave>" }
-- y guarda el JSON en Drive. La función solo lee y devuelve la misma estructura que el
-- botón «Respaldo completo (.json)» de Configuración (agrupado por cobro).
--
-- La clave NO se guarda aquí ni en el repositorio: en la base solo queda su SHA-256 en
-- private.backup_secret (esquema no expuesto por la API). Para cambiarla:
--   update private.backup_secret set secret_sha256 = encode(extensions.digest('<nueva>', 'sha256'), 'hex'), created_at = now();
-- y poner la nueva clave en el script de Google.
--
-- Advertencia esperada del linter: «anon puede ejecutar una función SECURITY DEFINER».
-- Es intencional: el script no inicia sesión; la protección es la clave (192 bits) y una
-- pausa de 1 s ante cada clave incorrecta.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.backup_secret (
  id int primary key default 1 check (id = 1),
  secret_sha256 text not null,
  created_at timestamptz not null default now()
);
-- insert into private.backup_secret (id, secret_sha256) values (1, '<sha256 de la clave>')
--   on conflict (id) do update set secret_sha256 = excluded.secret_sha256, created_at = now();

create or replace function public.backup_snapshot(secret text)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  expected text;
  result json;
begin
  select secret_sha256 into expected from private.backup_secret where id = 1;
  if expected is null or secret is null
     or encode(extensions.digest(secret, 'sha256'), 'hex') <> expected then
    perform pg_sleep(1);
    raise exception 'Clave de respaldo incorrecta' using errcode = '28000';
  end if;

  with cobros as (
    select r.id, coalesce(r.data->>'name', r.id) as nombre,
      json_build_object(
        'id', r.id,
        'nombre', coalesce(r.data->>'name', r.id),
        'ruta', to_json(r),
        'estado', (select to_json(s) from route_state s where s.route_id = r.id),
        'clientes', coalesce((select json_agg(c order by c.id) from clients c where c.route_id = r.id), '[]'::json),
        'solicitudes', coalesce((select json_agg(p order by p.id) from pending_requests p where p.route_id = r.id), '[]'::json),
        'recorridos', coalesce((select json_agg(w order by w.id) from worker_positions w where w.route_id = r.id), '[]'::json)
      ) as obj
    from routes r
  )
  select json_build_object(
    'app', 'EdgeCredit',
    'tipo', 'respaldo-completo',
    'version', 1,
    'generado', now(),
    'fuente', 'servidor-automatico',
    'resumen', json_build_object(
      'cobros', (select count(*) from routes),
      'clientes', (select count(*) from clients),
      'solicitudes', (select count(*) from pending_requests),
      'posicionesGps', (select count(*) from worker_positions),
      'usuarios', (select count(*) from profiles)
    ),
    'cobros', coalesce((select json_agg(obj order by nombre) from cobros), '[]'::json),
    'sinCobro', (
      select case when count(*) = 0 then null else json_build_object(
        'id', '', 'nombre', 'Sin cobro asignado', 'ruta', null, 'estado', null,
        'clientes', coalesce(json_agg(c order by c.id), '[]'::json), 'solicitudes', '[]'::json, 'recorridos', '[]'::json) end
      from clients c where c.route_id is null or not exists (select 1 from routes r where r.id = c.route_id)
    ),
    'usuarios', coalesce((select json_agg(p order by p.user_id) from profiles p), '[]'::json),
    'ajustes', coalesce((select json_agg(a order by a.key) from app_settings a), '[]'::json)
  ) into result;
  return result;
end;
$$;

revoke all on function public.backup_snapshot(text) from public, authenticated;
grant execute on function public.backup_snapshot(text) to anon;
