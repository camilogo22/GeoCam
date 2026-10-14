// services/photosRepository.ts
import { photosRepo } from '@/db/repositories/photos';
import { albumsRepo } from '@/db/repositories/albums';
import { persistPhoto, deletePhotoFile } from './photoFiles';
import type { GeoPhoto, Coords, AlbumItem, PhotoFilterOptions } from '@/types/geo';
import type { PhotoRecord } from '@/db/schema';

function mapRecordToGeoPhoto(p: PhotoRecord): GeoPhoto {
  return {
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
  };
}

export async function getFilteredPhotos(filters?: PhotoFilterOptions): Promise<GeoPhoto[]> {
  const records = await photosRepo.listQuery(filters);
  return records.map(mapRecordToGeoPhoto);
}

export async function getPhotosWithLocation(): Promise<GeoPhoto[]> {
  const records = await photosRepo.withLocationQuery();
  return records.map(mapRecordToGeoPhoto);
}

export async function getPhotoById(id: string): Promise<(GeoPhoto & { albumName?: string | null }) | null> {
  const record = await photosRepo.findById(id);
  if (!record) return null;

  const photo = mapRecordToGeoPhoto(record);
  let albumName: string | null = null;

  if (photo.albumId) {
    const album = await albumsRepo.findById(photo.albumId);
    if (album) albumName = album.name;
  }

  return { ...photo, albumName };
}

export async function insertPhoto(input: {
  id?: string;
  uri: string;
  coords: Coords | null;
  source: 'camera' | 'gallery';
  albumId?: number | null;
  note?: string | null;
  favorite?: boolean;
}): Promise<GeoPhoto> {
  // C5: Copiar foto a almacenamiento permanente
  const permanentUri = persistPhoto(input.uri);
  const id = input.id || String(Date.now());
  const createdAt = Date.now();

  // T4: Convertir Coords a columnas planas latitude, longitude, accuracy
  await photosRepo.create({
    id,
    uri: permanentUri,
    latitude: input.coords?.latitude ?? null,
    longitude: input.coords?.longitude ?? null,
    accuracy: input.coords?.accuracy ?? null,
    source: input.source,
    createdAt,
    albumId: input.albumId ?? null,
    note: input.note ?? null,
    favorite: input.favorite ?? false,
  });

  return {
    id,
    uri: permanentUri,
    coords: input.coords,
    source: input.source,
    createdAt,
    albumId: input.albumId ?? null,
    note: input.note ?? null,
    favorite: input.favorite ?? false,
  };
}

export async function updatePhoto(
  id: string,
  data: Partial<{
    uri?: string;
    note?: string | null;
    favorite?: boolean;
    albumId?: number | null;
  }>
): Promise<void> {
  await photosRepo.update(id, data);
}

export async function deletePhoto(id: string): Promise<void> {
  const record = await photosRepo.findById(id);
  if (record) {
    deletePhotoFile(record.uri);
    await photosRepo.remove(id);
  }
}

export async function clearAllPhotos(): Promise<void> {
  const records = await photosRepo.listQuery();
  records.forEach((r) => deletePhotoFile(r.uri));
  await photosRepo.clearAll();
}

export async function getAlbums(): Promise<AlbumItem[]> {
  const list = await albumsRepo.listQuery();
  return list.map((a) => ({
    id: a.id,
    name: a.name,
    createdAt: a.createdAt,
  }));
}

export async function createAlbum(name: string): Promise<AlbumItem> {
  const created = await albumsRepo.create(name);
  return {
    id: created.id,
    name: created.name,
    createdAt: created.createdAt,
  };
}

export async function deleteAlbum(id: number): Promise<void> {
  await albumsRepo.remove(id);
}

