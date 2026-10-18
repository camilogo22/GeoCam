// db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

function generateUUID(): string {
  try {
    // Intenta usar expo-crypto en runtime nativo
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExpoCrypto = require('expo-crypto');
    if (ExpoCrypto?.randomUUID) return ExpoCrypto.randomUUID();
  } catch {
    // Fallback a crypto de Node / Web
  }
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // Fallback manual
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at').notNull(),
});

export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  uri: text('uri').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracy: real('accuracy'),
  source: text('source', { enum: ['camera', 'gallery'] }).notNull().default('camera'),
  createdAt: integer('created_at').notNull(),
  albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }),
  note: text('note'),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),

  // Identidad compartida con Supabase (Semana 8 - T4)
  clientId: text('client_id').unique().$defaultFn(() => generateUUID()),
  // Momento de última edición para determinar si requiere resincronización
  updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
  // Ruta en el bucket y marca de tiempo de sincronización exitosa
  remotePath: text('remote_path'),
  syncedAt: integer('synced_at'),
  // Aislamiento local de fotos por usuario (Semana 8 - C5)
  ownerId: text('owner_id'),
});

export const albumsRelations = relations(albums, ({ many }) => ({
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  album: one(albums, {
    fields: [photos.albumId],
    references: [albums.id],
  }),
}));

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type PhotoRecord = typeof photos.$inferSelect;
export type NewPhotoRecord = typeof photos.$inferInsert;
