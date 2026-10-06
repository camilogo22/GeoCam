// app/(tabs)/mapa.tsx
import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import type { GeoPhoto } from '@/types/geo';

export default function MapaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { photos, albums } = useGeoPhotos();
  const { coords: currentCoords } = useGeoLocation({ watch: false });

  // Estado del buscador de fotos en el mapa
  const [searchText, setSearchText] = useState('');

  // Mapa de nombres de álbumes
  const albumMap = useMemo(() => {
    const map = new Map<number, string>();
    albums.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [albums]);

  // Fotos con coordenadas válidas
  const mappedPhotos = useMemo(
    () =>
      photos.filter(
        (p): p is GeoPhoto & { coords: NonNullable<GeoPhoto['coords']> } =>
          p.coords !== null
      ),
    [photos]
  );

  // Filtrado de fotos por nota descriptiva, nombre del álbum, origen o fecha
  const filteredMappedPhotos = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return mappedPhotos;
    return mappedPhotos.filter((p) => {
      const note = (p.note ?? '').toLowerCase();
      const albumName = (p.albumId ? albumMap.get(p.albumId) ?? '' : '').toLowerCase();
      const source = p.source === 'camera' ? 'cámara camara camera' : 'galería galeria gallery';
      const date = new Date(p.createdAt).toLocaleDateString().toLowerCase();

      return (
        note.includes(query) ||
        albumName.includes(query) ||
        source.includes(query) ||
        date.includes(query)
      );
    });
  }, [mappedPhotos, searchText, albumMap]);

  // Fotos sin ubicación (degradadas o importadas sin GPS)
  const unmappedPhotos = useMemo(() => {
    const unmapped = photos.filter((p) => p.coords === null);
    const query = searchText.trim().toLowerCase();
    if (!query) return unmapped;
    return unmapped.filter((p) => {
      const note = (p.note ?? '').toLowerCase();
      const albumName = (p.albumId ? albumMap.get(p.albumId) ?? '' : '').toLowerCase();
      return note.includes(query) || albumName.includes(query);
    });
  }, [photos, searchText, albumMap]);

  // Región inicial: ubicación actual del usuario o primera foto
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
    return {
      latitude: 4.6097,
      longitude: -74.0817,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [currentCoords, mappedPhotos]);

  // Centrar y enfocar en una foto seleccionada en el mapa
  const handleFocusPhoto = (photo: GeoPhoto & { coords: NonNullable<GeoPhoto['coords']> }) => {
    mapRef.current?.animateToRegion(
      {
        latitude: photo.coords.latitude,
        longitude: photo.coords.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      600
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {filteredMappedPhotos.map((photo) => (
          <Marker
            key={photo.id}
            coordinate={{
              latitude: photo.coords.latitude,
              longitude: photo.coords.longitude,
            }}
            title={
              photo.note
                ? photo.note
                : photo.source === 'camera'
                ? 'Foto de Cámara'
                : 'Foto de Galería'
            }
            description={new Date(photo.createdAt).toLocaleString()}
          >
            <Callout onPress={() => router.push(`/photo/${photo.id}`)}>
              <View style={styles.calloutBox}>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.calloutImage}
                  resizeMode="cover"
                />
                <Text style={styles.calloutText} numberOfLines={1}>
                  {photo.note
                    ? photo.note
                    : photo.source === 'camera'
                    ? 'Cámara'
                    : 'Galería'}
                </Text>
                {photo.albumId && albumMap.has(photo.albumId) && (
                  <Text style={styles.calloutAlbum} numberOfLines={1}>
                    📁 {albumMap.get(photo.albumId)}
                  </Text>
                )}
                <Text style={styles.calloutDate}>
                  {new Date(photo.createdAt).toLocaleTimeString()}
                </Text>
                <Text style={styles.calloutLink}>Toca para ver detalle</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Buscador Flotante Superior en el Mapa */}
      <View style={[styles.searchContainer, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#10b981" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar en el mapa por nota, álbum..."
            placeholderTextColor="#888888"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#a3a3a3" />
            </Pressable>
          )}
        </View>

        {/* Indicador de resultados de búsqueda */}
        {searchText.trim().length > 0 && (
          <View style={styles.searchSummaryRow}>
            <View style={styles.searchBadge}>
              <Text style={styles.searchBadgeText}>
                {filteredMappedPhotos.length}{' '}
                {filteredMappedPhotos.length === 1 ? 'marcador encontrado' : 'marcadores encontrados'}
              </Text>
            </View>
          </View>
        )}

        {/* Miniaturas de acceso rápido a las fotos encontradas */}
        {searchText.trim().length > 0 && filteredMappedPhotos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.resultsPreviewScroll}
          >
            {filteredMappedPhotos.map((photo) => (
              <Pressable
                key={photo.id}
                onPress={() => handleFocusPhoto(photo)}
                style={styles.resultChip}
              >
                <Image source={{ uri: photo.uri }} style={styles.resultChipThumb} />
                <View style={{ marginLeft: 6 }}>
                  <Text style={styles.resultChipText} numberOfLines={1}>
                    {photo.note || (photo.albumId ? albumMap.get(photo.albumId) : 'Foto')}
                  </Text>
                  <Text style={styles.resultChipSub}>Toca para enfocar</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* R3: Panel inferior para fotos sin coordenadas */}
      {unmappedPhotos.length > 0 && (
        <View style={[styles.unmappedPanel, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Text style={styles.unmappedTitle}>
            Fotos sin ubicación ({unmappedPhotos.length})
          </Text>
          <FlatList
            horizontal
            data={unmappedPhotos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/photo/${item.id}`)}
                style={styles.unmappedCard}
              >
                <Image source={{ uri: item.uri }} style={styles.unmappedThumb} />
                <View style={styles.unmappedBadge}>
                  <Text style={styles.unmappedBadgeText}>
                    {item.source === 'camera' ? '📷' : '🖼️'}
                  </Text>
                </View>
              </Pressable>
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
  searchContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.94)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  searchSummaryRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  searchBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  searchBadgeText: {
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultsPreviewScroll: {
    marginTop: 8,
  },
  resultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(23, 23, 23, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#10b981',
    maxWidth: 180,
  },
  resultChipThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  resultChipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    maxWidth: 110,
  },
  resultChipSub: {
    color: '#10b981',
    fontSize: 9,
  },
  calloutBox: {
    width: 150,
    alignItems: 'center',
    padding: 6,
  },
  calloutImage: {
    width: 140,
    height: 95,
    borderRadius: 8,
  },
  calloutText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 6,
    color: '#111827',
    textAlign: 'center',
  },
  calloutAlbum: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  calloutDate: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  calloutLink: {
    fontSize: 10,
    color: '#10b981',
    marginTop: 4,
    fontWeight: 'bold',
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
