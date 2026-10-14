// hooks/usePhotos.ts
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import {
  insertPhoto,
  updatePhoto,
  deletePhoto,
  clearAllPhotos,
} from '@/services/photosRepository';
import type { GeoPhoto, Coords, PhotoFilterOptions } from '@/types/geo';

export function usePhotos(filters: PhotoFilterOptions = {}) {
  // Consulta reactiva basada en filtros
  const listQuery = useMemo(
    () => photosRepo.listQuery(filters),
    [filters.search, filters.albumId, filters.onlyFavorites]
  );

  // Consulta reactiva para fotos con ubicación
  const locationQuery = useMemo(() => photosRepo.withLocationQuery(), []);

  // useLiveQuery actualiza automáticamente la UI ante cualquier cambio en SQLite
  const { data: rawPhotos = [] } = useLiveQuery(listQuery, [
    filters.search,
    filters.albumId,
    filters.onlyFavorites,
  ]);

  const { data: rawPhotosWithLocation = [] } = useLiveQuery(locationQuery);

  // Mapeo seguro de registros de base de datos a objetos tipo GeoPhoto
  const photos: GeoPhoto[] = useMemo(
    () =>
      (rawPhotos || []).map((p) => ({
        id: p.id,
        uri: p.uri,
        coords:
          p.latitude !== null && p.longitude !== null
            ? {
                latitude: p.latitude,
                longitude: p.longitude,
                accuracy: p.accuracy ?? null,
              }
            : null,
        source: (p.source as 'camera' | 'gallery') || 'camera',
        createdAt: p.createdAt,
        albumId: p.albumId ?? null,
        note: p.note ?? null,
        favorite: Boolean(p.favorite),
      })),
    [rawPhotos]
  );

  const photosWithLocation: GeoPhoto[] = useMemo(
    () =>
      (rawPhotosWithLocation || []).map((p) => ({
        id: p.id,
        uri: p.uri,
        coords:
          p.latitude !== null && p.longitude !== null
            ? {
                latitude: p.latitude,
                longitude: p.longitude,
                accuracy: p.accuracy ?? null,
              }
            : null,
        source: (p.source as 'camera' | 'gallery') || 'camera',
        createdAt: p.createdAt,
        albumId: p.albumId ?? null,
        note: p.note ?? null,
        favorite: Boolean(p.favorite),
      })),
    [rawPhotosWithLocation]
  );

  // T4: addPhoto convierte Coords a columnas planas y persiste la foto en FileSystem
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
      return await insertPhoto(data);
    },
    []
  );

  const removePhoto = useCallback(async (id: string) => {
    await deletePhoto(id);
  }, []);

  const clearAll = useCallback(async () => {
    await clearAllPhotos();
  }, []);

  const setNote = useCallback(async (id: string, note: string | null) => {
    await updatePhoto(id, { note });
  }, []);

  const setFavorite = useCallback(async (id: string, favorite: boolean) => {
    await updatePhoto(id, { favorite });
  }, []);

  const setAlbum = useCallback(async (id: string, albumId: number | null) => {
    await updatePhoto(id, { albumId });
  }, []);

  return {
    photos,
    photosWithLocation,
    loading: false,
    addPhoto,
    removePhoto,
    clearAll,
    setNote,
    setFavorite,
    setAlbum,
  };
}
