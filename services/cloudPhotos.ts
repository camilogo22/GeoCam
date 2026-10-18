// services/cloudPhotos.ts
import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import type { GeoPhoto } from '@/types/geo';

const BUCKET = 'geocam';

/**
 * T5 / C2: Sube una foto a Supabase Storage y registra su fila con metadatos en la tabla remota.
 * Funciona de forma segura con o sin sesión de usuario.
 */
export async function uploadPhoto(photo: GeoPhoto, userId?: string | null): Promise<string> {
  const clientId = photo.clientId || photo.id;
  const folder = userId || photo.ownerId || 'photos';
  const path = `${folder}/${clientId}.jpg`;

  // 1. Archivo local -> ArrayBuffer
  const arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());

  // 2. Subir al bucket privado en la carpeta correspondiente
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true, // C2: evita fallos por duplicados al reintentar
    });

  if (uploadError) {
    throw new Error(`Error al subir imagen a Storage: ${uploadError.message}`);
  }

  // 3. Fila remota con metadatos
  const takenAtDate = new Date(photo.createdAt);
  const updatedAtDate = photo.updatedAt ? new Date(photo.updatedAt) : takenAtDate;

  const payload: Record<string, any> = {
    client_id: clientId,
    storage_path: path,
    latitude: photo.coords?.latitude ?? null,
    longitude: photo.coords?.longitude ?? null,
    note: photo.note ?? null,
    favorite: Boolean(photo.favorite),
    source: photo.source || 'camera',
    taken_at: takenAtDate.toISOString(),
    updated_at: updatedAtDate.toISOString(),
  };

  if (userId || photo.ownerId) {
    payload.user_id = userId || photo.ownerId;
  }

  const { error: insertError } = await supabase.from('photos').upsert(
    payload,
    { onConflict: 'client_id' }
  );

  if (insertError) {
    // C2: Si falla la inserción de la fila, se elimina el archivo del bucket para evitar huérfanos
    try {
      await supabase.storage.from(BUCKET).remove([path]);
    } catch {
      // Ignora error al revertir
    }
    throw new Error(`Error al registrar foto en base de datos: ${insertError.message}`);
  }

  // 4. Marcar la foto local como sincronizada sin alterar updatedAt
  await photosRepo.markSynced(photo.id, path);

  return path;
}

/**
 * C1: Sube todas las fotos pendientes de sincronizar una por una.
 */
export async function syncPendingPhotos(
  photos: GeoPhoto[],
  onProgressOrUserId?: ((current: number, total: number) => void) | string | null,
  maybeOnProgress?: (current: number, total: number) => void
): Promise<{ uploaded: number; failed: number }> {
  const userId = typeof onProgressOrUserId === 'string' ? onProgressOrUserId : null;
  const onProgress = typeof onProgressOrUserId === 'function' ? onProgressOrUserId : maybeOnProgress;

  // Una foto está pendiente si syncedAt es nulo o si updatedAt es posterior a syncedAt
  const pending = photos.filter(
    (p) => !p.syncedAt || (p.updatedAt && p.updatedAt > p.syncedAt)
  );

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const photo = pending[i];
    if (onProgress) {
      onProgress(i + 1, pending.length);
    }
    try {
      await uploadPhoto(photo, userId);
      uploaded++;
    } catch (e) {
      console.warn(`Error sincronizando foto ${photo.id}:`, e);
      failed++;
    }
  }

  return { uploaded, failed };
}

/**
 * C3: Borrado coherente. Al eliminar una foto sincronizada, se borra también de la nube.
 */
export async function deleteCloudPhoto(remotePath: string, clientId: string): Promise<void> {
  // 1. Borrar de la tabla remota
  const { error: dbError } = await supabase.from('photos').delete().eq('client_id', clientId);
  if (dbError) {
    throw new Error(`Error eliminando registro en Supabase: ${dbError.message}`);
  }

  // 2. Borrar archivo del bucket
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([remotePath]);
  if (storageError) {
    console.warn('Error eliminando archivo en Storage:', storageError.message);
  }
}

/**
 * URL temporal firmada para visualizar fotos privadas de Supabase Storage.
 */
export async function getSignedPhotoUrl(remotePath: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(remotePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'No se pudo generar la URL firmada');
  }

  return data.signedUrl;
}

