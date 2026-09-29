// app/(tabs)/mapa.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, FlatList } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import type { GeoPhoto } from '@/types/geo';

export default function MapaScreen() {
  const { photos } = useGeoPhotos();
  const { coords: currentCoords } = useGeoLocation({ watch: false });

  // Fotos con coordenadas válidas
  const mappedPhotos = useMemo(
    () =>
      photos.filter(
        (p): p is GeoPhoto & { coords: NonNullable<GeoPhoto['coords']> } =>
          p.coords !== null
      ),
    [photos]
  );

  // Fotos sin ubicación (degradadas o importadas sin GPS)
  const unmappedPhotos = useMemo(
    () => photos.filter((p) => p.coords === null),
    [photos]
  );

  // Región inicial: ubicación actual del usuario o última foto tomada
  const initialRegion = useMemo(() => {
    if (currentCoords) {
      return {
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };
    }
    if (mappedPhotos.length > 0) {
      return {
        latitude: mappedPhotos[0].coords.latitude,
        longitude: mappedPhotos[0].coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    // Ubicación por defecto (ej. Bogotá, Colombia)
    return {
      latitude: 4.6097,
      longitude: -74.0817,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [currentCoords, mappedPhotos]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {mappedPhotos.map((photo) => (
          <Marker
            key={photo.id}
            coordinate={{
              latitude: photo.coords.latitude,
              longitude: photo.coords.longitude,
            }}
            title={
              photo.source === 'camera' ? 'Foto de Cámara' : 'Foto de Galería'
            }
            description={new Date(photo.createdAt).toLocaleTimeString()}
          >
            <Callout>
              <View style={styles.calloutBox}>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.calloutImage}
                  resizeMode="cover"
                />
                <Text style={styles.calloutText}>
                  {photo.source === 'camera' ? '📷 Cámara' : '🖼️ Galería'}
                </Text>
                <Text style={styles.calloutDate}>
                  {new Date(photo.createdAt).toLocaleTimeString()}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* R3: Panel inferior para fotos sin coordenadas */}
      {unmappedPhotos.length > 0 && (
        <View style={styles.unmappedPanel}>
          <Text style={styles.unmappedTitle}>
            Fotos sin ubicación ({unmappedPhotos.length})
          </Text>
          <FlatList
            horizontal
            data={unmappedPhotos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.unmappedCard}>
                <Image
                  source={{ uri: item.uri }}
                  style={styles.unmappedThumb}
                />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  map: {
    flex: 1,
  },
  calloutBox: {
    width: 140,
    alignItems: 'center',
    padding: 4,
  },
  calloutImage: {
    width: 130,
    height: 90,
    borderRadius: 8,
  },
  calloutText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 6,
    color: '#111827',
  },
  calloutDate: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  unmappedPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(23, 23, 23, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  unmappedTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  unmappedCard: {
    marginRight: 10,
    position: 'relative',
  },
  unmappedThumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#525252',
  },
  unmappedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#121212',
    borderRadius: 6,
    paddingHorizontal: 3,
  },
  unmappedBadgeText: {
    fontSize: 10,
  },
});
