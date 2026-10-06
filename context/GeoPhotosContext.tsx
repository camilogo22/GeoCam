// context/GeoPhotosContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  getFilteredPhotos,
  insertPhoto,
  updatePhoto,
  deletePhoto,
  clearAllPhotos,
  getAlbums,
  createAlbum,
  deleteAlbum,
} from '@/services/photosRepository';
import type { GeoPhoto, Coords, AlbumItem } from '@/types/geo';

interface GeoPhotosContextType {
  photos: GeoPhoto[];
  albums: AlbumItem[];
  loading: boolean;
  addPhoto: (photo: {
    id?: string;
    uri: string;
    coords: Coords | null;
    source: 'camera' | 'gallery';
    albumId?: number | null;
    note?: string | null;
    favorite?: boolean;
  }) => Promise<GeoPhoto>;
  removePhoto: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  setNote: (id: string, note: string | null) => Promise<void>;
  setFavorite: (id: string, favorite: boolean) => Promise<void>;
  setAlbum: (id: string, albumId: number | null) => Promise<void>;
  addAlbum: (name: string) => Promise<AlbumItem>;
  removeAlbum: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const GeoPhotosContext = createContext<GeoPhotosContextType | undefined>(undefined);

export function GeoPhotosProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [photoList, albumList] = await Promise.all([
        getFilteredPhotos(),
        getAlbums(),
      ]);
      setPhotos(photoList);
      setAlbums(albumList);
    } catch (e) {
      console.warn('Error al sincronizar contexto con SQLite:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addPhoto = useCallback(
    async (data: {
      id?: string;
      uri: string;
      coords: Coords | null;
      source: 'camera' | 'gallery';
      albumId?: number | null;
      note?: string | null;
      favorite?: boolean;
    }) => {
      const created = await insertPhoto(data);
      await loadAll();
      return created;
    },
    [loadAll]
  );

  const removePhoto = useCallback(
    async (id: string) => {
      await deletePhoto(id);
      await loadAll();
    },
    [loadAll]
  );

  const clearAll = useCallback(async () => {
    await clearAllPhotos();
    await loadAll();
  }, [loadAll]);

  const setNote = useCallback(
    async (id: string, note: string | null) => {
      await updatePhoto(id, { note });
      await loadAll();
    },
    [loadAll]
  );

  const setFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      await updatePhoto(id, { favorite });
      await loadAll();
    },
    [loadAll]
  );

  const setAlbum = useCallback(
    async (id: string, albumId: number | null) => {
      await updatePhoto(id, { albumId });
      await loadAll();
    },
    [loadAll]
  );

  const addAlbumHandler = useCallback(
    async (name: string) => {
      const created = await createAlbum(name);
      await loadAll();
      return created;
    },
    [loadAll]
  );

  const removeAlbumHandler = useCallback(
    async (id: number) => {
      await deleteAlbum(id);
      await loadAll();
    },
    [loadAll]
  );

  const value = useMemo(
    () => ({
      photos,
      albums,
      loading,
      addPhoto,
      removePhoto,
      clearAll,
      setNote,
      setFavorite,
      setAlbum,
      addAlbum: addAlbumHandler,
      removeAlbum: removeAlbumHandler,
      refresh: loadAll,
    }),
    [
      photos,
      albums,
      loading,
      addPhoto,
      removePhoto,
      clearAll,
      setNote,
      setFavorite,
      setAlbum,
      addAlbumHandler,
      removeAlbumHandler,
      loadAll,
    ]
  );

  return (
    <GeoPhotosContext.Provider value={value}>
      {children}
    </GeoPhotosContext.Provider>
  );
}

export function useGeoPhotos() {
  const context = useContext(GeoPhotosContext);
  if (!context) {
    throw new Error('useGeoPhotos debe ser usado dentro de un GeoPhotosProvider');
  }
  return context;
}
