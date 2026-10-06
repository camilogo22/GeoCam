// services/photoFiles.ts
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

// Carpeta permanente dentro del directorio de documentos de la app
let photosDir: Directory | null = null;
if (Platform.OS !== 'web') {
  try {
    photosDir = new Directory(Paths.document, 'photos');
  } catch {
    photosDir = null;
  }
}

/**
 * Copia la foto desde la ruta temporal de caché a la carpeta permanente de documentos.
 * Retorna la URI permanente para guardarla en SQLite.
 */
export function persistPhoto(cacheUri: string): string {
  if (Platform.OS === 'web' || !photosDir) {
    return cacheUri;
  }

  try {
    if (!photosDir.exists) {
      photosDir.create();
    }
    const source = new File(cacheUri);
    const destination = new File(photosDir, `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`);
    source.copy(destination);
    return destination.uri;
  } catch (e) {
    console.warn('Error al persistir archivo de foto en documentos:', e);
    return cacheUri;
  }
}

/**
 * Elimina físicamente el archivo del almacenamiento del dispositivo.
 */
export function deletePhotoFile(uri: string): void {
  if (Platform.OS === 'web') return;

  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (e) {
    console.warn('Error al eliminar archivo físico de foto:', e);
  }
}

