// app/(tabs)/mapa.web.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Image, FlatList, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import type { GeoPhoto } from '@/types/geo';

export default function MapaWebScreen() {
  const router = useRouter();
  const { photos, albums } = useGeoPhotos();
  const { coords: currentCoords } = useGeoLocation({ watch: false });
  const [searchText, setSearchText] = useState('');

  const albumMap = useMemo(() => {
    const map = new Map<number, string>();
    albums.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [albums]);

  const mappedPhotos = useMemo(
    () =>
      photos.filter(
        (p): p is GeoPhoto & { coords: NonNullable<GeoPhoto['coords']> } =>
          p.coords !== null
      ),
    [photos]
  );

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

  const unmappedPhotos = useMemo(
    () => {
      const unmapped = photos.filter((p) => p.coords === null);
      const query = searchText.trim().toLowerCase();
      if (!query) return unmapped;
      return unmapped.filter((p) => {
        const note = (p.note ?? '').toLowerCase();
        const albumName = (p.albumId ? albumMap.get(p.albumId) ?? '' : '').toLowerCase();
        return note.includes(query) || albumName.includes(query);
      });
    },
    [photos, searchText, albumMap]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Vista de Mapa (Modo Web)</Text>
        <Text style={styles.subtitle}>
          react-native-maps utiliza módulos nativos de iOS y Android. En el navegador web se muestra el registro georreferenciado de fotos.
        </Text>
      </View>

      {/* Buscador de fotos en el mapa */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#10b981" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar fotos en el mapa por nota, álbum..."
          placeholderTextColor="#737373"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color="#a3a3a3" />
          </Pressable>
        )}
      </View>

      {currentCoords && (
        <View style={styles.coordsCard}>
          <Text style={styles.coordsCardTitle}>Tu ubicación actual detectada:</Text>
          <Text style={styles.coordsCardValue}>
            Lat: {currentCoords.latitude.toFixed(5)} | Lon: {currentCoords.longitude.toFixed(5)}
          </Text>
        </View>
      )}

      {/* Fotos geolocalizadas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Fotos con Marcador GPS ({filteredMappedPhotos.length})
        </Text>
        {filteredMappedPhotos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {searchText.trim().length > 0
                ? 'No se encontraron fotos con coordenadas para esa búsqueda.'
                : 'Aún no hay fotos con coordenadas. Toma una foto con GPS activado desde GeoCam o pruébala en tu teléfono físico.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredMappedPhotos.map((photo) => (
              <Pressable
                key={photo.id}
                onPress={() => router.push(`/photo/${photo.id}`)}
                style={styles.photoCard}
              >
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoSource}>
                    {photo.source === 'camera' ? 'Cámara' : 'Galería'}
                  </Text>
                  {photo.albumId && albumMap.has(photo.albumId) && (
                    <Text style={styles.photoAlbum}>📁 {albumMap.get(photo.albumId)}</Text>
                  )}
                  {photo.note && (
                    <Text style={styles.photoNote} numberOfLines={1}>
                      {photo.note}
                    </Text>
                  )}
                  <Text style={styles.photoCoords}>
                    {photo.coords.latitude.toFixed(5)}, {photo.coords.longitude.toFixed(5)}
                  </Text>
                  <Text style={styles.photoTime}>
                    {new Date(photo.createdAt).toLocaleTimeString()}
                  </Text>
                  <Text style={styles.clickNote}>Toca para ver detalle</Text>
                </View>
              </Pressable>
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
              <Pressable
                onPress={() => router.push(`/photo/${item.id}`)}
                style={styles.unmappedCard}
              >
                <Image source={{ uri: item.uri }} style={styles.unmappedThumb} />
                <View style={styles.unmappedBadge}>
                  <Text style={styles.unmappedBadgeText}>
                    {item.source === 'camera' ? 'Cámara' : 'Galería'}
                  </Text>
                </View>
              </Pressable>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 4,
  },
  coordsCardValue: {
    fontSize: 13,
    color: '#ffffff',
    fontFamily: 'monospace',
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
  },
  emptyText: {
    color: '#a3a3a3',
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  photoCard: {
    backgroundColor: '#171717',
    borderRadius: 12,
    overflow: 'hidden',
    width: 240,
    borderWidth: 1,
    borderColor: '#262626',
  },
  photoImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#262626',
  },
  photoInfo: {
    padding: 12,
  },
  photoSource: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  photoAlbum: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  photoNote: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  photoCoords: {
    color: '#a3a3a3',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  photoTime: {
    color: '#737373',
    fontSize: 11,
  },
  clickNote: {
    color: '#10b981',
    fontSize: 11,
    marginTop: 6,
    fontWeight: 'bold',
  },
  unmappedCard: {
    marginRight: 10,
    position: 'relative',
  },
  unmappedThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#404040',
  },
  unmappedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  unmappedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
  },
});
