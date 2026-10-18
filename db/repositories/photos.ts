// db/repositories/photos.ts
import { eq, like, and, isNotNull, isNull, desc } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { photos, type PhotoRecord, type NewPhotoRecord } from '@/db/schema';
import type { PhotoFilterOptions } from '@/types/geo';

export const photosRepo = {
  /**
   * Genera la consulta Drizzle para listar fotos con filtros opcionales.
   * Compatible con useLiveQuery de drizzle-orm/expo-sqlite.
   */
  listQuery(filters?: PhotoFilterOptions) {
    const conditions = [];

    // C5: Filtrado por usuario propietario si se provee
    if (filters?.ownerId) {
      conditions.push(eq(photos.ownerId, filters.ownerId));
    }

    if (filters?.search && filters.search.trim().length > 0) {
      conditions.push(like(photos.note, `%${filters.search.trim()}%`));
    }

    if (filters?.onlyFavorites) {
      conditions.push(eq(photos.favorite, true));
    }

    if (filters?.albumId !== undefined && filters?.albumId !== 'all') {
      if (filters.albumId === null) {
        conditions.push(isNull(photos.albumId));
      } else {
        conditions.push(eq(photos.albumId, filters.albumId));
      }
    }

    const baseQuery = db.select().from(photos);
    if (conditions.length > 0) {
      return baseQuery.where(and(...conditions)).orderBy(desc(photos.createdAt));
    }
    return baseQuery.orderBy(desc(photos.createdAt));
  },

  /**
   * Genera la consulta Drizzle para fotos con coordenadas GPS (latitud no nula).
   */
  withLocationQuery(ownerId?: string | null) {
    const conditions = [isNotNull(photos.latitude)];
    if (ownerId) {
      conditions.push(eq(photos.ownerId, ownerId));
    }
    return db
      .select()
      .from(photos)
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt));
  },

  /**
   * Obtiene un registro individual por su ID.
   */
  async findById(id: string): Promise<PhotoRecord | undefined> {
    const results = await db.select().from(photos).where(eq(photos.id, id));
    return results[0];
  },

  /**
   * Inserta un nuevo registro de foto en SQLite.
   */
  async create(data: NewPhotoRecord) {
    return db.insert(photos).values(data);
  },

  /**
   * Actualiza los datos de un registro de foto.
   * Regla de Semana 8: actualiza también updatedAt.
   */
  async update(id: string, data: Partial<NewPhotoRecord>) {
    return db
      .update(photos)
      .set({
        ...data,
        updatedAt: Date.now(),
      })
      .where(eq(photos.id, id));
  },

  /**
   * Marca una foto como sincronizada en Supabase sin alterar updatedAt (T5).
   */
  async markSynced(id: string, remotePath: string) {
    return db
      .update(photos)
      .set({
        remotePath,
        syncedAt: Date.now(),
      })
      .where(eq(photos.id, id));
  },

  /**
   * T4: Rellena clientId y updatedAt en fotos tomadas antes de la migración.
   */
  async ensureSyncFields() {
    const rows = await db.select().from(photos).where(isNull(photos.clientId));
    for (const row of rows) {
      const generatedClientId = Crypto.randomUUID ? Crypto.randomUUID() : `cid_${Date.now()}_${Math.random()}`;
      await db
        .update(photos)
        .set({
          clientId: generatedClientId,
          updatedAt: row.updatedAt ?? row.createdAt,
        })
        .where(eq(photos.id, row.id));
    }
  },

  /**
   * Elimina un registro de foto de SQLite por ID.
   */
  async remove(id: string) {
    return db.delete(photos).where(eq(photos.id, id));
  },

  /**
   * Elimina todos los registros de la tabla photos.
   */
  async clearAll() {
    return db.delete(photos);
  },
};
