// app/(tabs)/galeria.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import type { GeoPhoto } from '@/types/geo';

export default function GaleriaScreen() {
  const router = useRouter();
  const { photos, albums, addAlbum, removeAlbum, setFavorite, removePhoto } = useGeoPhotos();

  // Estados de filtros (C4)
  const [searchText, setSearchText] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null | 'all'>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Modal para crear nuevo álbum
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');

  // Mapa de nombres de álbumes para búsqueda rápida y etiquetas
  const albumMap = useMemo(() => {
    const map = new Map<number, string>();
    albums.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [albums]);

  // Filtrado reactivo: busca por nota descriptiva, nombre del álbum, origen o fecha
  const filteredPhotos = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return photos.filter((p) => {
      if (query.length > 0) {
        const note = (p.note ?? '').toLowerCase();
        const albumName = (p.albumId ? albumMap.get(p.albumId) ?? '' : '').toLowerCase();
        const source = p.source === 'camera' ? 'cámara camara camera' : 'galería galeria gallery';
        const date = new Date(p.createdAt).toLocaleDateString().toLowerCase();

        const matchesNote = note.includes(query);
        const matchesAlbum = albumName.includes(query);
        const matchesSource = source.includes(query);
        const matchesDate = date.includes(query);

        if (!matchesNote && !matchesAlbum && !matchesSource && !matchesDate) {
          return false;
        }
      }

      // Filtro de favoritas
      if (onlyFavorites && !p.favorite) {
        return false;
      }

      // Filtro de álbum
      if (selectedAlbumId === 'all') {
        return true;
      } else if (selectedAlbumId === null) {
        return p.albumId === null || p.albumId === undefined;
      } else {
        return p.albumId === selectedAlbumId;
      }
    });
  }, [photos, searchText, selectedAlbumId, onlyFavorites, albumMap]);

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) {
      Alert.alert('Atención', 'El nombre del álbum no puede estar vacío.');
      return;
    }
    try {
      await addAlbum(newAlbumName.trim());
      setNewAlbumName('');
      setIsModalOpen(false);
    } catch {
      Alert.alert('Error', 'Ya existe un álbum con ese nombre o hubo un error.');
    }
  };

  const handleConfirmDeleteAlbum = (albumId: number, albumName: string) => {
    Alert.alert(
      '¿Eliminar álbum?',
      `Al eliminar el álbum "${albumName}", sus fotos quedarán sin álbum pero no se borrarán (ON DELETE SET NULL).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Álbum',
          style: 'destructive',
          onPress: async () => {
            await removeAlbum(albumId);
            if (selectedAlbumId === albumId) setSelectedAlbumId('all');
          },
        },
      ]
    );
  };

  // Eliminar individualmente la foto seleccionada
  const handleConfirmDeletePhoto = (photoId: string) => {
    Alert.alert(
      '¿Eliminar foto?',
      '¿Deseas eliminar permanentemente esta foto seleccionada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await removePhoto(photoId);
          },
        },
      ]
    );
  };

  const renderPhotoItem = ({ item }: { item: GeoPhoto }) => {
    const albumName = item.albumId ? albumMap.get(item.albumId) : null;
    return (
      <Pressable
        onPress={() => router.push(`/photo/${item.id}`)}
        style={({ pressed }) => [styles.photoCard, pressed && styles.cardPressed]}
      >
        <View style={styles.thumbWrapper}>
          <Image source={{ uri: item.uri }} style={styles.photoThumb} />

          {/* Botón interactivo para alternar Favoritos */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              setFavorite(item.id, !item.favorite);
            }}
            style={styles.cardFavoriteBtn}
            hitSlop={8}
          >
            <Ionicons
              name={item.favorite ? 'heart' : 'heart-outline'}
              size={18}
              color={item.favorite ? '#ef4444' : '#ffffff'}
            />
          </Pressable>

          {/* Botón interactivo para eliminar la foto seleccionada */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              handleConfirmDeletePhoto(item.id);
            }}
            style={styles.cardDeleteBtn}
            hitSlop={8}
          >
            <Ionicons name="trash" size={14} color="#ef4444" />
          </Pressable>
        </View>

        <View style={styles.photoInfo}>
          <Text style={styles.photoDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          {albumName && (
            <Text style={styles.photoAlbumTag} numberOfLines={1}>
              {albumName}
            </Text>
          )}
          {item.note && (
            <Text style={styles.photoNote} numberOfLines={1}>
              {item.note}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Encabezado con buscador (C4) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Galería y Álbumes</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#a3a3a3" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nota, álbum o fecha..."
            placeholderTextColor="#737373"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color="#a3a3a3" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Barra de Filtros por Álbum y Favoritas (C4) */}
      <View style={styles.filterSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { id: 'all', name: 'Todas' },
            { id: 'fav', name: 'Favoritas' },
            { id: null, name: 'Sin Álbum' },
            ...albums,
          ]}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const isFavItem = item.id === 'fav';
            const isActive = isFavItem
              ? onlyFavorites
              : !onlyFavorites && selectedAlbumId === item.id;

            return (
              <Pressable
                onPress={() => {
                  if (isFavItem) {
                    setOnlyFavorites((prev) => !prev);
                  } else {
                    setOnlyFavorites(false);
                    setSelectedAlbumId(item.id as number | null | 'all');
                  }
                }}
                onLongPress={() => {
                  if (typeof item.id === 'number') {
                    handleConfirmDeleteAlbum(item.id, item.name);
                  }
                }}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                {isFavItem && (
                  <Ionicons
                    name="heart"
                    size={14}
                    color={isActive ? '#0a0a0a' : '#ef4444'}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <Pressable
              onPress={() => setIsModalOpen(true)}
              style={styles.addAlbumBtn}
            >
              <Ionicons name="add" size={16} color="#10b981" />
              <Text style={styles.addAlbumText}>Nuevo Álbum</Text>
            </Pressable>
          }
        />
      </View>

      {/* Lista / Grid de Fotos */}
      {filteredPhotos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={48} color="#525252" />
          <Text style={styles.emptyTitle}>No hay fotos que coincidan</Text>
          <Text style={styles.emptySubtitle}>
            Prueba ajustando los filtros o capturando nuevas fotos con GeoCam.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPhotos}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          renderItem={renderPhotoItem}
        />
      )}

      {/* Modal para Crear Álbum */}
      <Modal visible={isModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear Nuevo Álbum</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre del álbum..."
              placeholderTextColor="#737373"
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateAlbum}
                style={[styles.modalBtn, styles.modalBtnConfirm]}
              >
                <Text style={styles.modalBtnTextConfirm}>Crear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingTop: 44, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#333333',
  },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 14 },
  filterSection: { paddingVertical: 8, paddingHorizontal: 16 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  filterChipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  filterChipText: { color: '#d4d4d4', fontSize: 13 },
  filterChipTextActive: { color: '#0a0a0a', fontWeight: 'bold' },
  addAlbumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10b981',
    gap: 4,
  },
  addAlbumText: { color: '#10b981', fontSize: 13, fontWeight: 'bold' },
  listContent: { padding: 10 },
  photoCard: {
    flex: 1,
    margin: 6,
    backgroundColor: '#171717',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  cardPressed: { opacity: 0.8 },
  thumbWrapper: { position: 'relative', width: '100%', height: 140 },
  photoThumb: { width: '100%', height: '100%', backgroundColor: '#262626' },
  cardFavoriteBtn: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    padding: 6,
  },
  cardDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    padding: 6,
  },
  photoInfo: { padding: 8 },
  photoDate: { color: '#a3a3a3', fontSize: 11 },
  photoAlbumTag: { color: '#10b981', fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  photoNote: { color: '#ffffff', fontSize: 12, marginTop: 2, fontWeight: '500' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  emptySubtitle: { color: '#737373', fontSize: 13, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 14 },
  modalInput: {
    backgroundColor: '#262626',
    color: '#ffffff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalBtnCancel: { backgroundColor: '#333333' },
  modalBtnConfirm: { backgroundColor: '#10b981' },
  modalBtnTextCancel: { color: '#ffffff', fontWeight: 'bold' },
  modalBtnTextConfirm: { color: '#000000', fontWeight: 'bold' },
});

