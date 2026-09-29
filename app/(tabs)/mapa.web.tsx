// app/(tabs)/mapa.web.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, FlatList, ScrollView } from 'react-native';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import type { GeoPhoto } from '@/types/geo';

export default function MapaWebScreen() {
  const { photos } = useGeoPhotos();
  const { coords: currentCoords } = useGeoLocation({ watch: false });

  const mappedPhotos = useMemo(
    () =>
      photos.filter(
        (p): p is GeoPhoto & { coords: NonNullable<GeoPhoto['coords']> } =>
          p.coords !== null
      ),
    [photos]
  );

  const unmappedPhotos = useMemo(
    () => photos.filter((p) => p.coords === null),
    [photos]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Vista de Mapa (Modo Web)</Text>
        <Text style={styles.subtitle}>
          react-native-maps utiliza módulos nativos de iOS y Android. En el navegador web se muestra el registro georreferenciado de fotos.
        </Text>
      </View>

      {currentCoords && (
        <View style={styles.coordsCard}>
          <Text style={styles.coordsCardTitle}>📍 Tu ubicación actual detectada:</Text>
          <Text style={styles.coordsCardValue}>
            Lat: {currentCoords.latitude.toFixed(5)} | Lon: {currentCoords.longitude.toFixed(5)}
          </Text>
        </View>
      )}

      {/* Fotos geolocalizadas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Fotos con Marcador GPS ({mappedPhotos.length})
        </Text>
        {mappedPhotos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Aún no hay fotos con coordenadas. Toma una foto con GPS activado desde GeoCam o pruébala en tu teléfono físico.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {mappedPhotos.map((photo) => (
              <View key={photo.id} style={styles.photoCard}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoSource}>
                    {photo.source === 'camera' ? '📷 Cámara' : '🖼️ Galería'}
                  </Text>
                  <Text style={styles.photoCoords}>
                    {photo.coords.latitude.toFixed(5)}, {photo.coords.longitude.toFixed(5)}
                  </Text>
                  <Text style={styles.photoTime}>
                    {new Date(photo.createdAt).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Fotos sin ubicación */}
      {unmappedPhotos.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Fotos sin ubicación ({unmappedPhotos.length})
          </Text>
          <FlatList
            horizontal
            data={unmappedPhotos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.unmappedCard}>
                <Image source={{ uri: item.uri }} style={styles.unmappedThumb} />
                <View style={styles.unmappedBadge}>
                  <Text style={styles.unmappedBadgeText}>
                    {item.source === 'camera' ? '📷' : '🖼️'}
                  </Text>
                </View>
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 24,
    maxWidth: 800,
    marginHorizontal: 'auto',
    width: '100%',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#a3a3a3',
    marginTop: 6,
    lineHeight: 20,
  },
  coordsCard: {
    backgroundColor: '#171717',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    marginBottom: 24,
  },
  coordsCardTitle: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 13,
  },
  coordsCardValue: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#171717',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  emptyText: {
    color: '#737373',
    fontSize: 14,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  photoCard: {
    backgroundColor: '#171717',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
    width: 220,
  },
  photoImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#262626',
  },
  photoInfo: {
    padding: 12,
  },
  photoSource: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  photoCoords: {
    color: '#10b981',
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 4,
  },
  photoTime: {
    color: '#737373',
    fontSize: 11,
    marginTop: 2,
  },
  unmappedCard: {
    marginRight: 12,
    position: 'relative',
  },
  unmappedThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#404040',
  },
  unmappedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#171717',
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  unmappedBadgeText: {
    fontSize: 10,
  },
});
