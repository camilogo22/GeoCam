// services/photoFiles.ts
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

// Directorio permanente para guardar fotos de la app
const photosDir = new Directory(Paths.document, 'photos');

/**
 * Copia una foto desde la ubicación temporal (caché o galería/content://) a la carpeta permanente de documentos.
 * Retorna la URI permanente guardada en el dispositivo.
 */
export async function persistPhoto(cacheUri: string): Promise<string> {
  // En Web o si es base64/URL remota, retornar la URI directamente
  if (Platform.OS === 'web' || !cacheUri || cacheUri.startsWith('data:') || cacheUri.startsWith('http')) {
    return cacheUri;
  }

  try {
    if (!photosDir.exists) {
      photosDir.create();
    }

    const filename = `geocam_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const destination = new File(photosDir, filename);

    // 1. Si es archivo local accesible mediante expo-file-system File (Next API)
    try {
      const source = new File(cacheUri);
      if (source.exists) {
        source.copy(destination);
        return destination.uri;
      }
    } catch {
      // Continuar con legacy
    }

    // 2. Soporte para content:// (Galería en Android) y ph:// (iOS) mediante FileSystem legacy copyAsync
    try {
      const FileSystem = await import('expo-file-system/legacy');
      await FileSystem.copyAsync({
        from: cacheUri,
        to: destination.uri,
      });
      return destination.uri;
    } catch {
      // Continuar al fallback de lectura/escritura
    }

    // 3. Fallback: lectura en base64 y escritura permanente
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const base64Data = await FileSystem.readAsStringAsync(cacheUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64Data) {
        await FileSystem.writeAsStringAsync(destination.uri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return destination.uri;
      }
    } catch {
      // Si falla todo, se retorna la URI original
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
export async function deletePhotoFile(uri: string): Promise<void> {
  if (Platform.OS === 'web' || !uri || uri.startsWith('data:') || uri.startsWith('http')) {
    return;
  }

  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
      return;
    }
  } catch {
    // Continuar con legacy deleteAsync
  }

  try {
    const FileSystem = await import('expo-file-system/legacy');
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    console.warn('Error eliminando archivo físico de foto:', e);
  }
}
