// services/photoFiles.ts
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

// Directorio permanente para guardar fotos de la app
const photosDir = new Directory(Paths.document, 'photos');

/**
 * Copia una foto desde la ubicación temporal (caché) a la carpeta permanente de documentos.
 * Retorna la URI permanente guardada en el dispositivo.
 */
export function persistPhoto(cacheUri: string): string {
  // En Web o si es base64/URL remota, retornar la URI directamente
  if (Platform.OS === 'web' || !cacheUri || cacheUri.startsWith('data:') || cacheUri.startsWith('http')) {
    return cacheUri;
  }

  try {
    if (!photosDir.exists) {
      photosDir.create();
    }

    const filename = `geocam_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const source = new File(cacheUri);
    const destination = new File(photosDir, filename);

    if (source.exists) {
      source.copy(destination);
      return destination.uri;
    }
    return cacheUri;
  } catch (e) {
    console.warn('Error persistiendo archivo de foto en FileSystem:', e);
    return cacheUri;
  }
}

/**
 * Elimina el archivo físico de la memoria del dispositivo cuando se borra su registro.
 */
export function deletePhotoFile(uri: string): void {
  if (Platform.OS === 'web' || !uri || uri.startsWith('data:') || uri.startsWith('http')) {
    return;
  }

  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (e) {
    console.warn('Error eliminando archivo físico de foto:', e);
  }
}

