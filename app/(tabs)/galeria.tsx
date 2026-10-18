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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { syncPendingPhotos } from '@/services/cloudPhotos';
import type { GeoPhoto } from '@/types/geo';

type CloudFilterType = 'all' | 'synced' | 'pending';

type FilterChipItem =
  | { id: string; type: 'general'; name: string }
  | { id: string; type: 'cloud'; cloud: 'synced' | 'pending'; name: string }
  | { id: string; type: 'favorite'; name: string }
  | { id: string; type: 'album'; albumId: number | null; name: string };

export default function GaleriaScreen() {
  const router = useRouter();
  const { photos, albums, addAlbum, removeAlbum, setFavorite, removePhoto, addPhoto, refresh } = useGeoPhotos();
  const geo = useGeoLocation({ watch: false });

  // Estados de filtros (C4)
  const [searchText, setSearchText] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null | 'all'>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [cloudFilter, setCloudFilter] = useState<CloudFilterType>('all');

  // Estado de sincronización en progreso desde galería
  const [isSyncing, setIsSyncing] = useState(false);

  // Modal para crear nuevo álbum
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');

  // Contador de fotos pendientes
  const pendingPhotos = useMemo(
    () => photos.filter((p) => !p.syncedAt || (p.updatedAt && p.updatedAt > p.syncedAt)),
    [photos]
  );

  // Mapa de nombres de álbumes para búsqueda rápida y etiquetas
  const albumMap = useMemo(() => {
    const map = new Map<number, string>();
    albums.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [albums]);

  // Importar foto desde la galería del dispositivo
  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permiso requerido',
          'Se necesita permiso de acceso a tus fotos para poder importar desde la galería.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
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

        await addPhoto(newPhoto);
        Alert.alert('Foto importada', 'La imagen de la galería se importó y guardó exitosamente en GeoCam.');
      }
    } catch (e: any) {
      console.warn('Error al seleccionar imagen de la galería:', e);
      Alert.alert('Error', e?.message || 'No se pudo cargar la imagen desde la galería.');
    }
  };

  // Sincronizar todas las fotos pendientes directamente desde la Galería
  const handleSyncAllFromGallery = async () => {
    if (pendingPhotos.length === 0) {
      Alert.alert('Al día', 'Todas las fotos ya están respaldadas en la nube.');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncPendingPhotos(photos);
      await refresh();
      Alert.alert(
        'Sincronización Completa',
        `Fotos sincronizadas a Supabase: ${result.uploaded}\nFallos: ${result.failed}`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error al sincronizar fotos con la nube.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtrado reactivo: busca por nota descriptiva, nombre del álbum, origen o fecha + estado de nube
  const filteredPhotos = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return photos.filter((p) => {
      const isSynced = Boolean(p.syncedAt && (!p.updatedAt || p.syncedAt >= p.updatedAt));

      // Filtro de estado en la nube
      if (cloudFilter === 'synced' && !isSynced) return false;
      if (cloudFilter === 'pending' && isSynced) return false;

      // Filtro de búsqueda textual
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
  }, [photos, searchText, selectedAlbumId, onlyFavorites, cloudFilter, albumMap]);

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
    const isCloudSynced = Boolean(
      item.syncedAt && (!item.updatedAt || item.syncedAt >= item.updatedAt)
    );

    return (
      <Pressable
        onPress={() => router.push(`/photo/${item.id}`)}
        style={({ pressed }) => [
          styles.photoCard,
          isCloudSynced ? styles.photoCardSynced : styles.photoCardPending,
          pressed && styles.cardPressed,
        ]}
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

          {/* Distintivo de Nube o Local destacado en la tarjeta */}
          <View
            style={[
              styles.cardCloudBadge,
              isCloudSynced
                ? styles.cardCloudBadgeSynced
                : styles.cardCloudBadgePending,
            ]}
          >
            <Ionicons
              name={isCloudSynced ? 'cloud-done' : 'cloud-offline'}
              size={12}
              color={isCloudSynced ? '#6ee7b7' : '#fbbf24'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.cardCloudBadgeText,
                isCloudSynced
                  ? styles.cardCloudBadgeTextSynced
                  : styles.cardCloudBadgeTextPending,
              ]}
            >
              {isCloudSynced ? 'En Nube' : 'Local'}
            </Text>
          </View>
        </View>

        <View style={[styles.photoInfo, isCloudSynced && styles.photoInfoSynced]}>
          <View style={styles.photoHeaderRow}>
            <Text style={styles.photoDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            {isCloudSynced ? (
              <View style={styles.syncMiniTag}>
                <Ionicons name="checkmark-circle" size={11} color="#10b981" />
                <Text style={styles.syncMiniText}>Nube</Text>
              </View>
            ) : (
              <View style={styles.pendingMiniTag}>
                <Ionicons name="time-outline" size={11} color="#f59e0b" />
                <Text style={styles.pendingMiniText}>Pendiente</Text>
              </View>
            )}
          </View>

          {albumName && (
            <Text style={styles.photoAlbumTag} numberOfLines={1}>
              📁 {albumName}
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
      {/* Encabezado con buscador y botones de acción rápida */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Galería y Álbumes</Text>
          <View style={styles.headerActions}>
            {/* Botón Importar desde Galería */}
            <Pressable
              onPress={handlePickFromGallery}
              style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="images" size={15} color="#10b981" />
              <Text style={styles.importBtnText}>Importar</Text>
            </Pressable>

            {/* Botón Sincronizar si hay pendientes */}
            {pendingPhotos.length > 0 && (
              <Pressable
                onPress={handleSyncAllFromGallery}
                disabled={isSyncing}
                style={({ pressed }) => [
                  styles.syncGalleryBtn,
                  pressed && { opacity: 0.8 },
                  isSyncing && { opacity: 0.6 },
                ]}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#0a0a0a" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={14} color="#0a0a0a" />
                    <Text style={styles.syncGalleryBtnText}>
                      Subir ({pendingPhotos.length})
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>

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

      {/* Barra de Filtros con estado de Nube, Álbum y Favoritas */}
      <View style={styles.filterSection}>
        <FlatList<FilterChipItem>
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { id: 'all', type: 'general', name: 'Todas' },
            { id: 'cloud_synced', type: 'cloud', cloud: 'synced', name: '☁️ En Nube' },
            { id: 'cloud_pending', type: 'cloud', cloud: 'pending', name: '⏳ Pendientes' },
            { id: 'fav', type: 'favorite', name: 'Favoritas' },
            { id: 'no_album', type: 'album', albumId: null, name: 'Sin Álbum' },
            ...albums.map((a) => ({ id: `alb_${a.id}`, type: 'album' as const, albumId: a.id, name: a.name })),
          ]}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            let isActive = false;
            if (item.type === 'general') {
              isActive = !onlyFavorites && selectedAlbumId === 'all' && cloudFilter === 'all';
            } else if (item.type === 'cloud') {
              isActive = cloudFilter === item.cloud;
            } else if (item.type === 'favorite') {
              isActive = onlyFavorites;
            } else if (item.type === 'album') {
              isActive = !onlyFavorites && cloudFilter === 'all' && selectedAlbumId === item.albumId;
            }

            return (
              <Pressable
                onPress={() => {
                  if (item.type === 'general') {
                    setOnlyFavorites(false);
                    setCloudFilter('all');
                    setSelectedAlbumId('all');
                  } else if (item.type === 'cloud') {
                    setCloudFilter((prev) => (prev === item.cloud ? 'all' : item.cloud));
                    setOnlyFavorites(false);
                    setSelectedAlbumId('all');
                  } else if (item.type === 'favorite') {
                    setOnlyFavorites((prev) => !prev);
                    setCloudFilter('all');
                    setSelectedAlbumId('all');
                  } else if (item.type === 'album') {
                    setOnlyFavorites(false);
                    setCloudFilter('all');
                    setSelectedAlbumId(item.albumId);
                  }
                }}
                onLongPress={() => {
                  if (item.type === 'album' && typeof item.albumId === 'number') {
                    handleConfirmDeleteAlbum(item.albumId, item.name);
                  }
                }}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  item.type === 'cloud' && item.cloud === 'synced' && styles.filterChipCloudSynced,
                ]}
              >
                {item.type === 'favorite' && (
                  <Ionicons
                    name="heart"
                    size={13}
                    color={isActive ? '#0a0a0a' : '#ef4444'}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                    item.type === 'cloud' && item.cloud === 'synced' && isActive && { color: '#0a0a0a' },
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
            Prueba ajustando los filtros o importa nuevas fotos desde la galería o la cámara.
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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17252a',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  importBtnText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  syncGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  syncGalleryBtnText: {
    color: '#0a0a0a',
    fontSize: 12,
    fontWeight: 'bold',
  },
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  filterChipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  filterChipCloudSynced: { borderColor: '#059669' },
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
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  photoCardPending: {
    backgroundColor: '#171717',
    borderColor: '#33261a',
  },
  photoCardSynced: {
    backgroundColor: '#0a1a12',
    borderColor: '#10b981',
    borderWidth: 2,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
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
  cardCloudBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardCloudBadgeSynced: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  cardCloudBadgePending: {
    backgroundColor: 'rgba(69, 26, 3, 0.85)',
    borderColor: '#d97706',
  },
  cardCloudBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardCloudBadgeTextSynced: {
    color: '#6ee7b7',
  },
  cardCloudBadgeTextPending: {
    color: '#fcd34d',
  },
  photoInfo: { padding: 8, backgroundColor: '#171717' },
  photoInfoSynced: { backgroundColor: '#081710' },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoDate: { color: '#a3a3a3', fontSize: 11 },
  syncMiniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  syncMiniText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pendingMiniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pendingMiniText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '500',
  },
  photoAlbumTag: { color: '#10b981', fontSize: 11, fontWeight: 'bold', marginTop: 3 },
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
