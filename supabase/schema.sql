-- =============================================================================
-- EdgeCredit · Esquema de base de datos para Supabase (PostgreSQL)
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
-- Se puede ejecutar más de una vez (crea o reemplaza lo que haga falta).
--
-- Modelo: cada registro guarda sus datos en una columna JSONB `data` (la misma forma
-- que usa la app) y las columnas de control (ruta, fechas) que necesita la seguridad.
-- La seguridad la hace la base de datos (Row Level Security):
--   · admin: ve y modifica todo.
--   · trabajador: solo su ruta (cobro), solo si su acceso está activo y dentro del
--     horario de acceso configurado por el admin.
--   · cuentas nuevas sin asignar ("pending"): no ven nada.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  username       text not null unique,
  role           text not null default 'pending' check (role in ('admin', 'worker', 'pending')),
  route_id       text,
  access_enabled boolean not null default true,
  data           jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);

create table if not exists public.routes (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table if not exists public.route_state (
  route_id   text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table if not exists public.clients (
  id         text primary key,
  route_id   text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index if not exists clients_route_idx on public.clients (route_id);

create table if not exists public.pending_requests (
  id         text primary key,
  route_id   text,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table if not exists public.app_settings (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- ── Funciones de apoyo para las reglas de seguridad ────────────────────────

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_route() returns text
language sql stable security definer set search_path = public as $$
  select route_id from public.profiles where user_id = auth.uid() and role = 'worker';
$$;

-- Horario de acceso de trabajadores (app_settings 'worker_access'): días 0-6
-- (0 = domingo), hora inicio/fin "HH:MM" en hora de Colombia. Soporta franjas nocturnas.
create or replace function public.schedule_allows_now() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb;
  local_now timestamp := (now() at time zone 'America/Bogota');
  dow int := extract(dow from local_now)::int;
  cur time := local_now::time;
  t_start time;
  t_end time;
  days int[];
begin
  select data into cfg from public.app_settings where key = 'worker_access';
  if cfg is null or coalesce((cfg->>'enabled')::boolean, false) = false then return true; end if;
  t_start := (cfg->>'start')::time;
  t_end := (cfg->>'end')::time;
  select coalesce(array_agg(value::int), '{}') into days from jsonb_array_elements_text(coalesce(cfg->'days', '[]'::jsonb));
  if t_start is null or t_end is null or t_start = t_end then return true; end if;
  if t_start < t_end then
    return dow = any(days) and cur >= t_start and cur < t_end;
  end if;
  -- Franja que cruza la medianoche: la madrugada pertenece al día anterior.
  if cur >= t_start then return dow = any(days); end if;
  if cur < t_end then return ((dow + 6) % 7) = any(days); end if;
  return false;
end;
$$;

create or replace function public.worker_can_access() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select access_enabled from public.profiles where user_id = auth.uid() and role = 'worker'), false)
         and public.schedule_allows_now();
$$;

-- Cada usuario nuevo de Supabase Auth recibe su perfil (queda "pending" hasta que el
-- admin le asigne ruta y rol desde la app).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, username, role)
  values (new.id, new.email, lower(split_part(new.email, '@', 1)), 'pending')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Acciones del administrador sobre cuentas (Personal) ─────────────────────

create or replace function public.admin_create_user(new_username text, new_password text, email_domain text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  clean text := lower(trim(new_username));
  mail text;
  uid uuid := gen_random_uuid();
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede crear usuarios'; end if;
  if clean !~ '^[a-z0-9._-]{3,40}$' then raise exception 'Usuario inválido (solo letras, números, punto, guion)'; end if;
  if length(coalesce(new_password, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres'; end if;
  mail := clean || '@' || email_domain;
  if exists (select 1 from auth.users where lower(email) = mail) then raise exception 'Ese usuario ya existe'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
          extensions.crypt(new_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
          'email', now(), now(), now());
  return uid;
end;
$$;

create or replace function public.admin_set_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede cambiar contraseñas'; end if;
  if length(coalesce(new_password, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now()
   where id = target;
end;
$$;

create or replace function public.admin_set_username(target uuid, new_username text, email_domain text) returns void
language plpgsql security definer set search_path = public as $$
declare clean text := lower(trim(new_username));
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede cambiar usuarios'; end if;
  if clean !~ '^[a-z0-9._-]{3,40}$' then raise exception 'Usuario inválido (solo letras, números, punto, guion)'; end if;
  update auth.users set email = clean || '@' || email_domain, updated_at = now() where id = target;
  update public.profiles set username = clean, email = clean || '@' || email_domain, updated_at = now() where user_id = target;
end;
$$;

create or replace function public.admin_reset_mfa(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede restablecer la verificación'; end if;
  delete from auth.mfa_factors where user_id = target;
end;
$$;

create or replace function public.admin_delete_user(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede eliminar cuentas'; end if;
  if target = auth.uid() then raise exception 'No puedes eliminar tu propia cuenta'; end if;
  delete from auth.users where id = target;
end;
$$;

-- ── Seguridad por filas (RLS) ───────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.routes enable row level security;
alter table public.route_state enable row level security;
alter table public.clients enable row level security;
alter table public.pending_requests enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists routes_select on public.routes;
create policy routes_select on public.routes for select to authenticated
  using (public.is_admin() or (id = public.my_route() and public.worker_can_access()));
drop policy if exists routes_insert on public.routes;
create policy routes_insert on public.routes for insert to authenticated
  with check (public.is_admin() or (id = public.my_route() and public.worker_can_access()));
drop policy if exists routes_update on public.routes;
create policy routes_update on public.routes for update to authenticated
  using (public.is_admin() or (id = public.my_route() and public.worker_can_access()))
  with check (public.is_admin() or (id = public.my_route() and public.worker_can_access()));
drop policy if exists routes_delete on public.routes;
create policy routes_delete on public.routes for delete to authenticated using (public.is_admin());

drop policy if exists route_state_select on public.route_state;
create policy route_state_select on public.route_state for select to authenticated
  using (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()));
drop policy if exists route_state_insert on public.route_state;
create policy route_state_insert on public.route_state for insert to authenticated
  with check (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()));
drop policy if exists route_state_update on public.route_state;
create policy route_state_update on public.route_state for update to authenticated
  using (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()))
  with check (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()));

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated
  using (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()));
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated
  with check (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()));
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
  using (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()))
  with check (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()));
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin());

drop policy if exists pending_select on public.pending_requests;
create policy pending_select on public.pending_requests for select to authenticated
  using (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()));
drop policy if exists pending_insert on public.pending_requests;
create policy pending_insert on public.pending_requests for insert to authenticated
  with check (public.is_admin() or (route_id = public.my_route() and public.worker_can_access()));
drop policy if exists pending_update on public.pending_requests;
create policy pending_update on public.pending_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists pending_delete on public.pending_requests;
create policy pending_delete on public.pending_requests for delete to authenticated using (public.is_admin());

drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings for select to authenticated using (true);
drop policy if exists settings_write on public.app_settings;
create policy settings_write on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Permisos: solo usuarios con sesión; los anónimos no leen nada.
revoke all on public.profiles, public.routes, public.route_state, public.clients, public.pending_requests, public.app_settings from anon;
grant select, insert, update, delete on public.profiles, public.routes, public.route_state, public.clients, public.pending_requests, public.app_settings to authenticated;
revoke execute on function public.admin_create_user(text, text, text), public.admin_set_password(uuid, text), public.admin_set_username(uuid, text, text), public.admin_reset_mfa(uuid), public.admin_delete_user(uuid) from anon, public;
grant execute on function public.admin_create_user(text, text, text), public.admin_set_password(uuid, text), public.admin_set_username(uuid, text, text), public.admin_reset_mfa(uuid), public.admin_delete_user(uuid) to authenticated;

-- ── Cuenta propia: cambio de contraseña y clave de recuperación ──

create table if not exists public.account_recovery (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  key_hash   text not null,
  created_at timestamptz not null default now()
);
alter table public.account_recovery enable row level security;
-- Sin políticas: nadie la lee directamente; solo las funciones de abajo.
revoke all on public.account_recovery from anon, authenticated;

-- Comprueba la contraseña actual del usuario con sesión.
create or replace function public.check_my_password(current_password text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select encrypted_password = extensions.crypt(current_password, encrypted_password)
                     from auth.users where id = auth.uid()), false);
$$;

-- Cambiar la propia contraseña (pide la actual).
create or replace function public.change_my_password(current_password text, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  if not public.check_my_password(current_password) then raise exception 'La contraseña actual no es correcta'; end if;
  if length(coalesce(new_password, '')) < 8 then raise exception 'La nueva contraseña debe tener al menos 8 caracteres'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now()
   where id = auth.uid();
end;
$$;

-- Genera (o reemplaza) la clave de recuperación. Se muestra una sola vez.
create or replace function public.create_my_recovery_key(current_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  raw text := upper(encode(extensions.gen_random_bytes(15), 'hex'));
  pretty text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  if not public.check_my_password(current_password) then raise exception 'La contraseña actual no es correcta'; end if;
  pretty := substr(raw, 1, 6) || '-' || substr(raw, 7, 6) || '-' || substr(raw, 13, 6) || '-' || substr(raw, 19, 6) || '-' || substr(raw, 25, 6);
  insert into public.account_recovery (user_id, key_hash, created_at)
  values (auth.uid(), extensions.crypt(raw, extensions.gen_salt('bf')), now())
  on conflict (user_id) do update set key_hash = excluded.key_hash, created_at = now();
  return pretty;
end;
$$;

-- ¿El usuario con sesión tiene clave de recuperación? (fecha de creación o null)
create or replace function public.my_recovery_key_date() returns timestamptz
language sql stable security definer set search_path = public as $$
  select created_at from public.account_recovery where user_id = auth.uid();
$$;

-- Recuperar acceso sin sesión: usuario + clave de recuperación → nueva contraseña.
-- También quita el autenticador (se vuelve a registrar al entrar) y la clave queda usada.
create or replace function public.recover_password(login_email text, recovery_key text, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid;
  stored text;
  clean text := upper(regexp_replace(coalesce(recovery_key, ''), '[^0-9A-Fa-f]', '', 'g'));
begin
  if length(coalesce(new_password, '')) < 8 then raise exception 'La nueva contraseña debe tener al menos 8 caracteres'; end if;
  perform pg_sleep(0.5);
  select u.id, r.key_hash into uid, stored
    from auth.users u join public.account_recovery r on r.user_id = u.id
   where lower(u.email) = lower(trim(login_email));
  if uid is null or stored <> extensions.crypt(clean, stored) then
    raise exception 'Usuario o clave de recuperación incorrectos';
  end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now() where id = uid;
  delete from auth.mfa_factors where user_id = uid;
  delete from public.account_recovery where user_id = uid;
end;
$$;

revoke execute on function public.check_my_password(text), public.change_my_password(text, text), public.create_my_recovery_key(text), public.my_recovery_key_date(), public.recover_password(text, text, text) from public, anon;
grant execute on function public.check_my_password(text), public.change_my_password(text, text), public.create_my_recovery_key(text), public.my_recovery_key_date() to authenticated;
grant execute on function public.recover_password(text, text, text) to anon, authenticated;

-- El admin puede borrar el estado de una ruta eliminada.
drop policy if exists route_state_delete on public.route_state;
create policy route_state_delete on public.route_state for delete to authenticated using (public.is_admin());
grant delete on public.route_state to authenticated;

-- ── Tiempo real: los cambios de un usuario llegan al instante a los demás ──
do $$
declare t text;
begin
  foreach t in array array['profiles', 'routes', 'route_state', 'clients', 'pending_requests', 'app_settings'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =============================================================================
-- ÚLTIMO PASO (una sola vez): después de crear el usuario administrador en
-- Authentication → Users (correo admin@edgecredit.app), conviértelo en admin:
--
--   update public.profiles set role = 'admin' where email = 'admin@edgecredit.app';
-- =============================================================================
