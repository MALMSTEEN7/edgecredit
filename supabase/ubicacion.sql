-- EdgeCredit · Estado de la ubicación del celular de cada trabajador.
--
-- El celular del trabajador anota si su ubicación funciona (activa, sin señal, permiso sin
-- aceptar, bloqueada o navegador sin ubicación). El administrador lo ve en Personal.
-- Cada trabajador solo escribe su propia fila; solo el admin (y el mismo trabajador) la leen.
-- Se puede ejecutar varias veces sin problema.

create table if not exists public.worker_device_status (
  worker_id uuid primary key references auth.users(id) on delete cascade,
  gps text not null check (gps in ('active', 'searching', 'prompt', 'denied', 'unsupported')),
  detail text,
  updated_at timestamptz not null default now()
);

alter table public.worker_device_status enable row level security;
drop policy if exists worker_device_status_select on public.worker_device_status;
create policy worker_device_status_select on public.worker_device_status for select to authenticated
  using (public.is_admin() or worker_id = auth.uid());
drop policy if exists worker_device_status_insert on public.worker_device_status;
create policy worker_device_status_insert on public.worker_device_status for insert to authenticated
  with check (worker_id = auth.uid());
drop policy if exists worker_device_status_update on public.worker_device_status;
create policy worker_device_status_update on public.worker_device_status for update to authenticated
  using (worker_id = auth.uid()) with check (worker_id = auth.uid());
revoke all on public.worker_device_status from anon;
grant select, insert, update on public.worker_device_status to authenticated;
