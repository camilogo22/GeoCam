// db/repositories/albums.ts
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, type Album, type NewAlbum } from '@/db/schema';

export const albumsRepo = {
  /**
   * Genera la consulta Drizzle para listar álbumes ordenados alfabéticamente.
   * Compatible con useLiveQuery.
   */
  listQuery() {
    return db.select().from(albums).orderBy(asc(albums.name));
  },

  /**
   * Busca un álbum por su ID.
   */
  async findById(id: number): Promise<Album | undefined> {
    const results = await db.select().from(albums).where(eq(albums.id, id));
    return results[0];
  },

  /**
   * Crea un nuevo álbum si no existe.
   */
  async create(name: string): Promise<Album> {
    const data: NewAlbum = {
      name,
      createdAt: Date.now(),
    };
    const result = await db.insert(albums).values(data).returning();
    if (result && result[0]) {
      return result[0];
    }
    // Fallback si returning() no devuelve en alguna plataforma
    const inserted = await db.select().from(albums).where(eq(albums.name, name));
    return inserted[0];
  },

  /**
   * Elimina un álbum por ID (las fotos asociadas quedan con albumId = null gracias a ON DELETE SET NULL).
   */
  async remove(id: number) {
    return db.delete(albums).where(eq(albums.id, id));
  },
};

