import { File } from 'expo-file-system';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos } from '@/db/schema';
import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import type { GeoPhoto } from '@/types/geo';

const BUCKET = 'geocam';

function generateUUID(): string {
  try {
    const ExpoCrypto = require('expo-crypto');
    if (ExpoCrypto?.randomUUID) return ExpoCrypto.randomUUID();
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * T5 / C2: Sube una foto a Supabase Storage y registra su fila con metadatos en la tabla remota.
 * Funciona de forma segura con o sin sesión de usuario.
 */
export async function uploadPhoto(photo: GeoPhoto, userId?: string | null): Promise<string> {
  // Asegurar que el clientId sea un UUID válido para compatibilidad total
  let clientId = photo.clientId;
  if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    clientId = generateUUID();
    try {
      await db.update(photos).set({ clientId }).where(eq(photos.id, photo.id));
    } catch {
      // Ignora si falla la actualización previa
    }
  }

  const folder = userId || photo.ownerId || 'photos';
  const path = `${folder}/${clientId}.jpg`;

  // 1. Archivo local -> ArrayBuffer (usa File.arrayBuffer nativo o fallback a fetch)
  let arrayBuffer: ArrayBuffer;
  try {
    const localFile = new File(photo.uri);
    if (localFile.exists) {
      arrayBuffer = await localFile.arrayBuffer();
    } else {
      arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
    }
  } catch {
    arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
  }

  // 2. Subir al bucket en la carpeta correspondiente
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
  const now = Date.now();
  const takenAtDate = new Date(photo.createdAt);

  const payload: Record<string, any> = {
    client_id: clientId,
    storage_path: path,
    latitude: photo.coords?.latitude ?? null,
    longitude: photo.coords?.longitude ?? null,
    note: photo.note ?? null,
    favorite: Boolean(photo.favorite),
    source: photo.source || 'camera',
    taken_at: takenAtDate.toISOString(),
    updated_at: new Date(now).toISOString(),
  };

  const effectiveUserId = userId || photo.ownerId;
  if (effectiveUserId) {
    payload.user_id = effectiveUserId;
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

  // 4. Marcar la foto local como sincronizada
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

