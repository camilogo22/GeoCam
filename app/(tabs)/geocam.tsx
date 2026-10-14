// app/(tabs)/geocam.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useCamera } from '@/hooks/useCamera';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useShake } from '@/hooks/useShake';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import type { GeoPhoto } from '@/types/geo';

export default function GeoCamScreen() {
  const router = useRouter();
  const cam = useCamera();
  const geo = useGeoLocation({ watch: true });
  const { photos, addPhoto, clearAll } = useGeoPhotos();
  const [lastPhoto, setLastPhoto] = useState<GeoPhoto | null>(photos[0] ?? null);

  // T5: Integración de Shake para eliminar todas las fotos con confirmación
  useShake(() => {
    Alert.alert(
      '¿Vaciar galería?',
      'Has agitado el dispositivo. ¿Deseas eliminar permanentemente todas las fotos de SQLite y del almacenamiento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar Todo',
          style: 'destructive',
          onPress: async () => {
            await clearAll();
            setLastPhoto(null);
          },
        },
      ]
    );
  });

  // Si aún está consultando permisos iniciales
  if (cam.permissionState === 'checking') {
    return <View style={styles.loadingContainer} />;
  }

  // Si no hay permiso de cámara, mostrar componente explicativo
  if (cam.permissionState !== 'granted') {
    return (
      <PermissionPrimer
        title="GeoCam necesita tu cámara"
        description="La usamos solo para tomar fotos que tú decidas guardar."
        state={cam.permissionState}
        onRequest={cam.requestPermission}
        onOpenSettings={cam.openSettings}
      />
    );
  }

  // Tomar foto con la cámara
  const handleCapture = async () => {
    const photo = await cam.takePhoto();
    if (!photo) return;

    // T4: Degradación elegante: sin permiso de ubicación, coords queda en null
    const coords =
      geo.permission === 'granted'
        ? geo.coords ?? (await geo.getCurrent())
        : null;

    const newPhoto = {
      id: String(Date.now()),
      uri: photo.uri,
      coords,
      source: 'camera' as const,
      createdAt: Date.now(),
    };

    // T4 & C5: Guardar en FileSystem permanente y SQLite
    const saved = await addPhoto(newPhoto);
    setLastPhoto(saved);
  };

  // Importar imagen desde la galería
  const handlePickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const coords =
        geo.permission === 'granted'
          ? geo.coords ?? (await geo.getCurrent())
          : null;

      const newPhoto = {
        id: String(Date.now()),
        uri: result.assets[0].uri,
        coords,
        source: 'gallery' as const,
        createdAt: Date.now(),
      };

      const saved = await addPhoto(newPhoto);
      setLastPhoto(saved);
    }
  };

  return (
    <View style={styles.container}>
      {/* CameraView sin hijos: los controles van como hermanos en posición absoluta */}
      <CameraView
        ref={cam.cameraRef}
        style={StyleSheet.absoluteFill}
        facing={cam.facing}
        onCameraReady={cam.onCameraReady}
      />

      {/* Banner de ubicación: pedir en contexto sin bloquear la cámara */}
      {geo.permission !== 'granted' && geo.permission !== 'checking' && (
        <Pressable
          onPress={
            geo.permission === 'blocked' ? geo.openSettings : geo.requestPermission
          }
          style={styles.locationBanner}
        >
          <Text style={styles.bannerText}>
            ⚠️ Activa la ubicación para etiquetar tus fotos
          </Text>
        </Pressable>
      )}

      {/* Coordenadas en vivo cuando el GPS está activo */}
      {geo.coords && (
        <View style={styles.coordsBadge}>
          <Text style={styles.coordsText}>
            {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)}
          </Text>
          <Text style={styles.coordsAccuracy}>
            ±{Math.round(geo.coords.accuracy ?? 0)} m
          </Text>
        </View>
      )}

      {/* Controles inferiores */}
      <View style={styles.bottomBar}>
        {/* Botón de galería / última foto con distintivo de origen */}
        <Pressable
          onPress={() => {
            const currentLast = photos[0] || lastPhoto;
            if (currentLast) {
              router.push(`/photo/${currentLast.id}`);
            } else {
              handlePickFromGallery();
            }
          }}
          onLongPress={handlePickFromGallery}
          style={styles.thumbnailBtn}
        >
          {photos[0] || lastPhoto ? (
            <View>
              <Image source={{ uri: (photos[0] || lastPhoto)!.uri }} style={styles.thumbnail} />
              <View style={styles.sourceTag}>
                <Text style={styles.sourceTagText}>
                  {(photos[0] || lastPhoto)!.source === 'camera' ? '📷' : '🖼️'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.galleryPlaceholder}>
              <Text style={{ fontSize: 24 }}>🖼️</Text>
            </View>
          )}
        </Pressable>

        {/* Botón de disparo */}
        <Pressable
          onPress={handleCapture}
          disabled={cam.isCapturing}
          style={styles.shutterOuter}
          accessibilityLabel="Tomar foto"
        >
          <View
            style={[
              styles.shutterInner,
              cam.isCapturing && styles.shutterCapturing,
            ]}
          />
        </Pressable>

        {/* Botón cambiar orientación de cámara */}
        <Pressable
          onPress={cam.toggleFacing}
          style={styles.toggleBtn}
          accessibilityLabel="Cambiar cámara"
        >
          <Text style={styles.toggleText}>↻</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  locationBanner: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.95)',
    borderRadius: 12,
    padding: 12,
    zIndex: 10,
  },
  bannerText: {
    color: '#1c1917',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  coordsBadge: {
    position: 'absolute',
    top: 56,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 9,
  },
  coordsText: {
    color: '#6ee7b7',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
  },
  coordsAccuracy: {
    color: '#a3a3a3',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 10,
  },
  thumbnailBtn: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  galleryPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#404040',
  },
  sourceTag: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#171717',
    borderRadius: 8,
    padding: 2,
  },
  sourceTagText: {
    fontSize: 10,
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
  },
  shutterCapturing: {
    backgroundColor: '#a3a3a3',
  },
  toggleBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
