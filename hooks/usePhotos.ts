// hooks/usePhotos.ts
import { useState, useEffect, useCallback } from 'react';
import {
  getFilteredPhotos,
  insertPhoto,
  updatePhoto,
  deletePhoto,
  clearAllPhotos,
  type PhotoFilterOptions,
} from '@/services/photosRepository';
import type { GeoPhoto, Coords } from '@/types/geo';

export function usePhotos(filters: PhotoFilterOptions = {}) {
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPhotos = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getFilteredPhotos(filters);
      setPhotos(list);
    } catch (e) {
      console.warn('Error cargando fotos desde SQLite:', e);
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.albumId, filters.onlyFavorites]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

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
      await loadPhotos();
      return created;
    },
    [loadPhotos]
  );

  const removePhoto = useCallback(
    async (id: string) => {
      await deletePhoto(id);
      await loadPhotos();
    },
    [loadPhotos]
  );

  const clearAll = useCallback(async () => {
    await clearAllPhotos();
    await loadPhotos();
  }, [loadPhotos]);

  const setNote = useCallback(
    async (id: string, note: string | null) => {
      await updatePhoto(id, { note });
      await loadPhotos();
    },
    [loadPhotos]
  );

  const setFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      await updatePhoto(id, { favorite });
      await loadPhotos();
    },
    [loadPhotos]
  );

  const setAlbum = useCallback(
    async (id: string, albumId: number | null) => {
      await updatePhoto(id, { albumId });
      await loadPhotos();
    },
    [loadPhotos]
  );

  return {
    photos,
    loading,
    refresh: loadPhotos,
    addPhoto,
    removePhoto,
    clearAll,
    setNote,
    setFavorite,
    setAlbum,
  };
}
