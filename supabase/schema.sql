-- GeoCam · Semana 8: Backend as a Service con Supabase
-- Ejecutar en el SQL Editor de tu proyecto de Supabase

-- 1. Tabla remota de fotos
create table if not exists public.photos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
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

-- Políticas RLS: cada usuario solo ve, crea, actualiza y borra sus propias fotos
create policy "ver las mías" on public.photos
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "crear las mías" on public.photos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "actualizar las mías" on public.photos
  for update to authenticated
  using ((select auth.uid()) = user_id);

create policy "borrar las mías" on public.photos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Habilitar Supabase Realtime para la tabla photos
alter publication supabase_realtime add table public.photos;

-- 4. Bucket privado 'geocam': fotos personales protegidas por RLS
insert into storage.buckets (id, name, public)
values ('geocam', 'geocam', false)
on conflict (id) do nothing;

-- 5. Políticas de Storage para el bucket privado 'geocam'
-- Convención: cada archivo va en <id-de-usuario>/<archivo>.jpg

create policy "subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'geocam'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "leer mi carpeta" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'geocam'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'geocam'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

