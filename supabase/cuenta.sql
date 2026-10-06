-- EdgeCredit · cuenta propia: cambio de contraseña y clave de recuperación.
-- Se puede ejecutar más de una vez.

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
