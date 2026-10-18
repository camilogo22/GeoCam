import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos } from '@/db/schema';
import { supabase, supabaseKey } from '@/lib/supabase';
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

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/=+$/, '');
  const len = clean.length;
  const bufferLength = (len * 3) >> 2;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = chars.indexOf(clean[i]);
    const enc2 = chars.indexOf(clean[i + 1]);
    const enc3 = i + 2 < len ? chars.indexOf(clean[i + 2]) : 64;
    const enc4 = i + 3 < len ? chars.indexOf(clean[i + 3]) : 64;
    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (enc3 !== 64 && p < bufferLength) bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    if (enc4 !== 64 && p < bufferLength) bytes[p++] = ((enc3 & 3) << 6) | enc4;
  }
  return arrayBuffer;
}

export async function readPhotoAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  // 1. Data URI base64
  if (uri.startsWith('data:')) {
    const commaIndex = uri.indexOf(',');
    const base64Data = commaIndex !== -1 ? uri.substring(commaIndex + 1) : uri;
    return base64ToArrayBuffer(base64Data);
  }

  // 2. Si no es web, intentar con File nativo de expo-file-system Next API
  if (Platform.OS !== 'web') {
    try {
      const localFile = new File(uri);
      if (localFile.exists) {
        const buf = await localFile.arrayBuffer();
        if (buf && buf.byteLength > 0) return buf;
      }
    } catch {
      // Continuar a fallback de lectura
    }

    // 2b. FileSystem legacy readAsStringAsync (funciona con content:// de Android y file://)
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64) {
        return base64ToArrayBuffer(base64);
      }
    } catch {
      // Continuar a fetch
    }
  }

  // 3. Fallback a fetch para web o URLs http
  const res = await fetch(uri);
  return await res.arrayBuffer();
}

/**
 * T5 / C2: Sube una foto a Supabase Storage y registra su fila con metadatos en la tabla remota.
 * Funciona de forma segura con o sin sesión de usuario.
 */
export async function uploadPhoto(photo: GeoPhoto, userId?: string | null): Promise<string> {
  if (!supabaseKey || supabaseKey.includes('xxxxxxxx') || supabaseKey === 'placeholder-key') {
    throw new Error(
      'Falta configurar tu clave anon/public de Supabase en el archivo .env (EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Copia la anon public key desde el panel de Supabase: https://supabase.com/dashboard/project/xrsajlzauklhnyekuuks/settings/api'
    );
  }

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

  // 1. Archivo local -> ArrayBuffer (soporta file://, content://, base64 y web)
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await readPhotoAsArrayBuffer(photo.uri);
  } catch (err: any) {
    throw new Error(`No se pudo leer el archivo de la foto para subirlo: ${err?.message || err}`);
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

