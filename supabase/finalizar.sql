-- EdgeCredit · último paso en el proyecto ya creado (pegar en SQL Editor → Run).
-- Permite al administrador borrar clientes/cuentas y restablecer 2FA, y cierra el acceso anónimo.
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

drop policy if exists routes_delete on public.routes;
create policy routes_delete on public.routes for delete to authenticated using (public.is_admin());
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin());
drop policy if exists pending_delete on public.pending_requests;
create policy pending_delete on public.pending_requests for delete to authenticated using (public.is_admin());
grant delete on public.routes, public.clients, public.pending_requests to authenticated;

revoke all on public.profiles, public.routes, public.route_state, public.clients, public.pending_requests, public.app_settings from anon;
revoke execute on function public.admin_create_user(text, text, text), public.admin_set_password(uuid, text), public.admin_set_username(uuid, text, text), public.admin_reset_mfa(uuid), public.admin_delete_user(uuid) from anon, public;
grant execute on function public.admin_create_user(text, text, text), public.admin_set_password(uuid, text), public.admin_set_username(uuid, text, text), public.admin_reset_mfa(uuid), public.admin_delete_user(uuid) to authenticated;
