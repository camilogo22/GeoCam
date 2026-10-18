-- GeoCam · Semana 8: Backend as a Service con Supabase (Sin barrera de Login)
-- Ejecutar en el SQL Editor de tu proyecto de Supabase

-- 1. Tabla remota de fotos
create table if not exists public.photos (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid(), -- opcional si no hay login
  client_id uuid not null unique, -- UUID único creado en el teléfono que identifica la foto
  storage_path text not null unique,
  latitude double precision,
  longitude double precision,
  note text,
  favorite boolean not null default false,
  source text not null check (source in ('camera', 'gallery')),
  taken_at timestamptz not null,
  updated_at timestamptz not null, -- última modificación hecha por el usuario
  created_at timestamptz not null default now()
);

-- 2. Habilitar Row Level Security (RLS)
alter table public.photos enable row level security;

-- Políticas RLS permitiendo operaciones con clave anónima o autenticada
create policy "ver fotos" on public.photos
  for select to anon, authenticated
  using (true);

create policy "crear fotos" on public.photos
  for insert to anon, authenticated
  with check (true);

create policy "actualizar fotos" on public.photos
  for update to anon, authenticated
  using (true);

create policy "borrar fotos" on public.photos
  for delete to anon, authenticated
  using (true);

-- 3. Habilitar Supabase Realtime para la tabla photos
alter publication supabase_realtime add table public.photos;

-- 4. Bucket 'geocam' para almacenamiento de fotos
insert into storage.buckets (id, name, public)
values ('geocam', 'geocam', true)
on conflict (id) do update set public = true;

-- 5. Políticas de Storage para el bucket 'geocam'
create policy "subir fotos geocam" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'geocam');

create policy "leer fotos geocam" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'geocam');

create policy "borrar fotos geocam" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'geocam');
