// services/photosRepository.ts
import { eq, like, and, isNull, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos, albums, type Album } from '@/db/schema';
import { persistPhoto, deletePhotoFile } from '@/services/photoFiles';
import type { GeoPhoto, Coords, AlbumItem } from '@/types/geo';

export interface PhotoFilterOptions {
  search?: string;
  albumId?: number | null; // number: filtrar por ese album; null: fotos sin album; undefined: todos
  onlyFavorites?: boolean;
}

function recordToGeoPhoto(r: typeof photos.$inferSelect): GeoPhoto {
  const coords: Coords | null =
    r.latitude !== null && r.longitude !== null
      ? {
          latitude: r.latitude,
          longitude: r.longitude,
          accuracy: r.accuracy,
          timestamp: r.createdAt,
        }
      : null;

  return {
    id: r.id,
    uri: r.uri,
    coords,
    source: r.source as 'camera' | 'gallery',
    createdAt: r.createdAt,
    albumId: r.albumId,
    note: r.note,
    favorite: r.favorite,
  };
}

/**
 * Consulta fotos aplicando filtros por nota (like), álbum y favoritas.
 */
export async function getFilteredPhotos(options: PhotoFilterOptions = {}): Promise<GeoPhoto[]> {
  const conditions = [];

  // Filtro por búsqueda de texto en nota
  if (options.search && options.search.trim().length > 0) {
    conditions.push(like(photos.note, `%${options.search.trim()}%`));
  }

  // Filtro por favoritas
  if (options.onlyFavorites) {
    conditions.push(eq(photos.favorite, true));
  }

  // Filtro por álbum: si se especifica null, busca fotos sin álbum
  if (options.albumId === null) {
    conditions.push(isNull(photos.albumId));
  } else if (typeof options.albumId === 'number') {
    conditions.push(eq(photos.albumId, options.albumId));
  }

  const query = db
    .select()
    .from(photos)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(photos.createdAt));

  const rows = await query;
  return rows.map(recordToGeoPhoto);
}

/**
 * Obtiene el detalle de una foto específica por su ID.
 */
export async function getPhotoById(
  id: string
): Promise<(GeoPhoto & { albumName?: string | null }) | null> {
  const rows = await db
    .select({
      photo: photos,
      albumName: albums.name,
    })
    .from(photos)
    .leftJoin(albums, eq(photos.albumId, albums.id))
    .where(eq(photos.id, id))
    .limit(1);

  if (rows.length === 0) return null;
  const item = rows[0];
  const geoPhoto = recordToGeoPhoto(item.photo);
  return {
    ...geoPhoto,
    albumName: item.albumName ?? null,
  };
}

/**
 * Guarda una nueva foto: primero la persiste en la carpeta de documentos (C5)
 * y luego registra la nueva ruta permanente en SQLite.
 */
export async function insertPhoto(photo: {
  id?: string;
  uri: string;
  coords: Coords | null;
  source: 'camera' | 'gallery';
  albumId?: number | null;
  note?: string | null;
  favorite?: boolean;
}): Promise<GeoPhoto> {
  // C5: Copiar de caché a almacenamiento permanente
  const permanentUri = persistPhoto(photo.uri);
  const id = photo.id ?? String(Date.now());
  const now = Date.now();

  await db.insert(photos).values({
    id,
    uri: permanentUri,
    latitude: photo.coords?.latitude ?? null,
    longitude: photo.coords?.longitude ?? null,
    accuracy: photo.coords?.accuracy ?? null,
    source: photo.source,
    createdAt: now,
    albumId: photo.albumId ?? null,
    note: photo.note ?? null,
    favorite: photo.favorite ?? false,
  });

  return {
    id,
    uri: permanentUri,
    coords: photo.coords,
    source: photo.source,
    createdAt: now,
    albumId: photo.albumId ?? null,
    note: photo.note ?? null,
    favorite: photo.favorite ?? false,
  };
}

/**
 * Actualiza los campos de una foto (nota, favorita, álbum).
 */
export async function updatePhoto(
  id: string,
  updates: {
    note?: string | null;
    favorite?: boolean;
    albumId?: number | null;
  }
): Promise<void> {
  await db
    .update(photos)
    .set({
      ...(updates.note !== undefined && { note: updates.note }),
      ...(updates.favorite !== undefined && { favorite: updates.favorite }),
      ...(updates.albumId !== undefined && { albumId: updates.albumId }),
    })
    .where(eq(photos.id, id));
}

/**
 * Elimina el registro en SQLite y borra físicamente el archivo del almacenamiento (C5).
 */
export async function deletePhoto(id: string): Promise<void> {
  const existing = await db
    .select({ uri: photos.uri })
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);

  if (existing.length > 0) {
    // Elimina el archivo permanente
    deletePhotoFile(existing[0].uri);
  }

  // Elimina de SQLite
  await db.delete(photos).where(eq(photos.id, id));
}

/**
 * Elimina todas las fotos de la base de datos y sus archivos físicos.
 */
export async function clearAllPhotos(): Promise<void> {
  const all = await db.select({ uri: photos.uri }).from(photos);
  for (const item of all) {
    deletePhotoFile(item.uri);
  }
  await db.delete(photos);
}

/**
 * Obtiene la lista completa de álbumes.
 */
export async function getAlbums(): Promise<AlbumItem[]> {
  const rows = await db.select().from(albums).orderBy(desc(albums.createdAt));
  return rows.map((a: Album) => ({
    id: a.id,
    name: a.name,
    createdAt: a.createdAt,
  }));
}

/**
 * Crea un nuevo álbum con nombre único.
 */
export async function createAlbum(name: string): Promise<AlbumItem> {
  const now = Date.now();
  const result = await db
    .insert(albums)
    .values({
      name: name.trim(),
      createdAt: now,
    })
    .returning();

  return {
    id: result[0].id,
    name: result[0].name,
    createdAt: result[0].createdAt,
  };
}

/**
 * Elimina un álbum. Por regla ON DELETE SET NULL, las fotos pertenecientes
 * a este álbum quedan huérfanas (albumId = null) pero no se borran (C1).
 */
export async function deleteAlbum(id: number): Promise<void> {
  await db.delete(albums).where(eq(albums.id, id));
}
