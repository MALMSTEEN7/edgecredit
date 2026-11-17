-- EdgeCredit · Consola del administrador: historial de movimientos.
--
-- Cada vez que se crea, cambia o borra un cliente, un cobro (ruta), una solicitud, un perfil o
-- un ajuste, el servidor anota QUIÉN lo hizo, CUÁNDO y QUÉ cambió (solo los campos que
-- cambiaron; en las listas, qué elementos se agregaron y cuáles se quitaron). Lo anota la base
-- de datos misma (trigger), así queda registrado venga del celular que venga.
--
-- - Solo el administrador puede leerlo. Nadie lo puede modificar ni borrar desde la app.
-- - Si anotar falla por cualquier motivo, el guardado sigue normal (nunca bloquea a nadie).
-- - Las fotos de los comprobantes no se copian al historial (aparecen como «[foto]»).
-- - Se guardan 90 días.
-- - La app también anota los choques que resolvió combinando dos equipos (log_sync_merge).
--
-- Se ejecuta una sola vez en Supabase → SQL Editor (se puede volver a ejecutar sin problema).

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  table_name text not null,
  row_key text not null,
  route_id text,
  action text not null check (action in ('insert', 'update', 'delete', 'merge')),
  actor uuid,
  actor_name text,
  changes jsonb not null default '[]'::jsonb
);

create index if not exists audit_log_route_at on public.audit_log (route_id, at desc);
create index if not exists audit_log_row_at on public.audit_log (table_name, row_key, at desc);
create index if not exists audit_log_at on public.audit_log (at);
create index if not exists audit_log_actor_at on public.audit_log (actor, at desc);

alter table public.audit_log enable row level security;
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log for select to authenticated using (public.is_admin());
revoke all on public.audit_log from anon;
revoke insert, update, delete, truncate on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;

/**
 * Diferencias entre dos valores JSON como lista de cambios:
 *   { "p": ["campo", "subcampo"], "old": …, "new": … }       valor cambiado
 *   { "p": ["payments"], "added": […], "removed": […] }       lista: elementos agregados/quitados
 * Baja hasta `depth` niveles dentro de los objetos (p. ej. ledger → día).
 */
create or replace function public.audit_diff(a jsonb, b jsonb, path text[], depth int)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  result jsonb := '[]'::jsonb;
  k text;
begin
  if a is not distinct from b then return result; end if;
  if depth > 0 and jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
    for k in select jsonb_object_keys(a) union select jsonb_object_keys(b) loop
      if (a -> k) is distinct from (b -> k) then
        result := result || public.audit_diff(coalesce(a -> k, 'null'::jsonb), coalesce(b -> k, 'null'::jsonb), path || k, depth - 1);
      end if;
    end loop;
    return result;
  end if;
  if jsonb_typeof(a) = 'array' and jsonb_typeof(b) = 'array' then
    return jsonb_build_array(jsonb_build_object(
      'p', to_jsonb(path),
      'added', coalesce((select jsonb_agg(e) from (select e from jsonb_array_elements(b) e except all select e from jsonb_array_elements(a) e) x), '[]'::jsonb),
      'removed', coalesce((select jsonb_agg(e) from (select e from jsonb_array_elements(a) e except all select e from jsonb_array_elements(b) e) x), '[]'::jsonb)
    ));
  end if;
  return jsonb_build_array(jsonb_build_object('p', to_jsonb(path), 'old', a, 'new', b));
end $$;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb;
  n jsonb;
  od jsonb;
  nd jsonb;
  diff jsonb;
  row_key text;
  route text;
  who uuid;
  who_name text;
begin
  begin
    if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
    if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
    row_key := coalesce(n ->> 'id', n ->> 'user_id', n ->> 'key', n ->> 'route_id', o ->> 'id', o ->> 'user_id', o ->> 'key', o ->> 'route_id');
    route := case tg_table_name
      when 'routes' then coalesce(n ->> 'id', o ->> 'id')
      when 'app_settings' then null
      else coalesce(n ->> 'route_id', o ->> 'route_id') end;
    if tg_table_name = 'profiles' then
      od := case when o is null then '{}'::jsonb else jsonb_build_object('access_enabled', o -> 'access_enabled', 'route_id', o -> 'route_id', 'role', o -> 'role', 'username', o -> 'username', 'data', o -> 'data') end;
      nd := case when n is null then '{}'::jsonb else jsonb_build_object('access_enabled', n -> 'access_enabled', 'route_id', n -> 'route_id', 'role', n -> 'role', 'username', n -> 'username', 'data', n -> 'data') end;
    else
      od := coalesce(o -> 'data', '{}'::jsonb);
      nd := coalesce(n -> 'data', '{}'::jsonb);
    end if;
    diff := public.audit_diff(od, nd, array[]::text[], 2);
    if tg_op = 'UPDATE' and diff = '[]'::jsonb then return null; end if;
    -- Fotos (data:image/…;base64,…): no se copian al historial.
    diff := regexp_replace(diff::text, '"data:[a-zA-Z]+/[^"]*"', '"[foto]"', 'g')::jsonb;
    who := auth.uid();
    select username into who_name from public.profiles where user_id = who;
    insert into public.audit_log (table_name, row_key, route_id, action, actor, actor_name, changes)
    values (tg_table_name, coalesce(row_key, '?'), route, lower(tg_op), who, who_name, diff);
    -- Limpieza ocasional: más de 90 días.
    if random() < 0.002 then
      delete from public.audit_log where at < now() - interval '90 days';
    end if;
  exception when others then
    -- El historial nunca debe impedir guardar.
    raise warning 'audit_row (%): %', tg_table_name, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists clients_audit on public.clients;
create trigger clients_audit after insert or update or delete on public.clients for each row execute function public.audit_row();
drop trigger if exists routes_audit on public.routes;
create trigger routes_audit after insert or update or delete on public.routes for each row execute function public.audit_row();
drop trigger if exists pending_requests_audit on public.pending_requests;
create trigger pending_requests_audit after insert or update or delete on public.pending_requests for each row execute function public.audit_row();
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after insert or update or delete on public.profiles for each row execute function public.audit_row();
drop trigger if exists app_settings_audit on public.app_settings;
create trigger app_settings_audit after insert or update or delete on public.app_settings for each row execute function public.audit_row();

/**
 * La app anota aquí cuando dos equipos cambiaron el mismo registro a la vez y lo combinó
 * (choque resuelto). El trabajador solo puede anotar en su propio cobro.
 */
create or replace function public.log_sync_merge(p_table text, p_key text, p_route text, p_changes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  who uuid := auth.uid();
  details jsonb := coalesce(p_changes, '[]'::jsonb);
begin
  if who is null or p_table not in ('clients', 'routes', 'route_state') then return; end if;
  if not public.is_admin() and p_route is distinct from public.my_route() then return; end if;
  details := regexp_replace(details::text, '"data:[a-zA-Z]+/[^"]*"', '"[foto]"', 'g')::jsonb;
  if octet_length(details::text) > 20000 then details := jsonb_build_array(jsonb_build_object('p', '[]'::jsonb, 'note', 'detalle muy largo')); end if;
  insert into public.audit_log (table_name, row_key, route_id, action, actor, actor_name, changes)
  values (p_table, left(coalesce(p_key, '?'), 200), p_route, 'merge', who, (select username from public.profiles where user_id = who), details);
end $$;

revoke all on function public.log_sync_merge(text, text, text, jsonb) from public, anon;
grant execute on function public.log_sync_merge(text, text, text, jsonb) to authenticated;
revoke all on function public.audit_row() from public, anon, authenticated;
