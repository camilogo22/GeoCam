// context/GeoPhotosContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { usePhotos } from '@/hooks/usePhotos';
import { useAlbums } from '@/hooks/useAlbums';
import type { GeoPhoto, Coords, AlbumItem } from '@/types/geo';

interface GeoPhotosContextType {
  photos: GeoPhoto[];
  photosWithLocation: GeoPhoto[];
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
    ownerId?: string | null;
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
  // Sin login: todas las fotos locales están disponibles directamente
  const {
    photos,
    photosWithLocation,
    loading: photosLoading,
    addPhoto: addPhotoBase,
    removePhoto,
    clearAll,
    setNote,
    setFavorite,
    setAlbum,
  } = usePhotos();

  const {
    albums,
    loading: albumsLoading,
    addAlbum,
    removeAlbum,
  } = useAlbums();

  const addPhoto = (photo: {
    id?: string;
    uri: string;
    coords: Coords | null;
    source: 'camera' | 'gallery';
    albumId?: number | null;
    note?: string | null;
    favorite?: boolean;
    ownerId?: string | null;
  }) => {
    return addPhotoBase(photo);
  };

  const refresh = async () => {
    // Las consultas son reactivas con useLiveQuery
  };

  const value = useMemo(
    () => ({
      photos,
      photosWithLocation,
      albums,
      loading: photosLoading || albumsLoading,
      addPhoto,
      removePhoto,
      clearAll,
      setNote,
      setFavorite,
      setAlbum,
      addAlbum,
      removeAlbum,
      refresh,
    }),
    [
      photos,
      photosWithLocation,
      albums,
      photosLoading,
      albumsLoading,
      addPhoto,
      removePhoto,
      clearAll,
      setNote,
      setFavorite,
      setAlbum,
      addAlbum,
      removeAlbum,
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
