// hooks/useAlbums.ts
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { albumsRepo } from '@/db/repositories/albums';
import { createAlbum, deleteAlbum } from '@/services/photosRepository';
import type { AlbumItem } from '@/types/geo';

export function useAlbums() {
  const listQuery = useMemo(() => albumsRepo.listQuery(), []);
  const { data: rawAlbums = [] } = useLiveQuery(listQuery);

  const albums: AlbumItem[] = useMemo(
    () =>
      (rawAlbums || []).map((a) => ({
        id: a.id,
        name: a.name,
        createdAt: a.createdAt,
      })),
    [rawAlbums]
  );

  const addAlbum = useCallback(async (name: string) => {
    return await createAlbum(name);
  }, []);

  const removeAlbum = useCallback(async (id: number) => {
    await deleteAlbum(id);
  }, []);

  return {
    albums,
    loading: false,
    addAlbum,
    removeAlbum,
  };
}
