-- =============================================================
-- MiniPOS · esquema Supabase
-- Ejecutar en: Supabase > SQL Editor > New query > Run
-- =============================================================

create table if not exists public.registros (
  coleccion   text        not null,   -- productos, ventas, cajas, usuarios, ...
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  primary key (coleccion, id)
);

create index if not exists registros_coleccion_idx on public.registros (coleccion);
create index if not exists registros_fecha_venta_idx on public.registros ((data->>'fecha')) where coleccion = 'ventas';

-- Tiempo real (PC de caja <-> celulares)
alter table public.registros replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.registros;
exception when duplicate_object then null; end $$;

-- Seguridad (versión demo / piloto):
-- La app usa la clave anon desde el navegador, así que esta política permite
-- leer/escribir a quien tenga la URL + clave. Para producción se migra a
-- Supabase Auth (un usuario por cajero) y políticas por rol.
alter table public.registros enable row level security;
drop policy if exists "minipos_anon_rw" on public.registros;
create policy "minipos_anon_rw" on public.registros
  for all to anon, authenticated
  using (true) with check (true);
