-- EdgeCredit · recorrido GPS de los trabajadores (pegar en Supabase → SQL Editor → Run).
-- Solo agrega la tabla worker_positions: no modifica clientes, rutas ni usuarios. Se puede correr más de una vez.
create table if not exists public.worker_positions (
  id          bigint generated always as identity primary key,
  worker_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  route_id    text,
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  accuracy    real,
  speed       real,
  recorded_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists worker_positions_worker_time_idx on public.worker_positions (worker_id, recorded_at desc);

alter table public.worker_positions enable row level security;
drop policy if exists worker_positions_insert on public.worker_positions;
create policy worker_positions_insert on public.worker_positions for insert to authenticated
  with check (worker_id = auth.uid() and exists (select 1 from public.profiles where user_id = auth.uid() and role = 'worker'));
drop policy if exists worker_positions_select on public.worker_positions;
create policy worker_positions_select on public.worker_positions for select to authenticated
  using (public.is_admin() or worker_id = auth.uid());
drop policy if exists worker_positions_delete on public.worker_positions;
create policy worker_positions_delete on public.worker_positions for delete to authenticated
  using (public.is_admin());
revoke all on public.worker_positions from anon;
grant select, insert, delete on public.worker_positions to authenticated;

-- Tiempo real: el mapa del administrador recibe cada punto nuevo al instante.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'worker_positions') then
    alter publication supabase_realtime add table public.worker_positions;
  end if;
end $$;
