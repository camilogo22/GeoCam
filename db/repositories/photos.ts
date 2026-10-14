// db/repositories/photos.ts
import { eq, like, and, isNotNull, isNull, desc } from 'drizzle-orm';
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
  withLocationQuery() {
    return db
      .select()
      .from(photos)
      .where(isNotNull(photos.latitude))
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
   */
  async update(id: string, data: Partial<NewPhotoRecord>) {
    return db.update(photos).set(data).where(eq(photos.id, id));
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

