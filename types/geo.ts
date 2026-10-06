// types/geo.ts

export type PermissionState =
  | 'checking'
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'blocked';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface GeoPhoto {
  id: string;
  uri: string;
  coords: Coords | null; // null si el usuario negó la ubicación (degradación elegante)
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
