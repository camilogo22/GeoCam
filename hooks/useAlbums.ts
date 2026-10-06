// hooks/useAlbums.ts
import { useState, useEffect, useCallback } from 'react';
import { getAlbums, createAlbum, deleteAlbum } from '@/services/photosRepository';
import type { AlbumItem } from '@/types/geo';

export function useAlbums() {
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlbums = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getAlbums();
      setAlbums(list);
    } catch (e) {
      console.warn('Error al cargar álbumes:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const addAlbum = useCallback(
    async (name: string) => {
      const created = await createAlbum(name);
      await loadAlbums();
      return created;
    },
    [loadAlbums]
  );

  const removeAlbum = useCallback(
    async (id: number) => {
      await deleteAlbum(id);
      await loadAlbums();
    },
    [loadAlbums]
  );

  return {
    albums,
    loading,
    refresh: loadAlbums,
    addAlbum,
    removeAlbum,
  };
}

