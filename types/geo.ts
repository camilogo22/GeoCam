// types/geo.ts

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp?: number;
}

export type PermissionState = 'checking' | 'granted' | 'denied' | 'blocked' | 'undetermined';

export interface GeoPhoto {
  id: string;
  uri: string;
  coords: Coords | null;
  source: 'camera' | 'gallery';
  createdAt: number;
  albumId?: number | null;
  note?: string | null;
  favorite?: boolean;
}

export interface AlbumItem {
  id: number;
  name: string;
  createdAt: number;
}

export interface PhotoFilterOptions {
  search?: string;
  albumId?: number | null | 'all';
  onlyFavorites?: boolean;
}

