// app/photo/[id].tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPhotoById, getAlbums } from '@/services/photosRepository';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import type { GeoPhoto, AlbumItem } from '@/types/geo';

export default function PhotoDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { setNote, setFavorite, setAlbum, removePhoto, refresh, addAlbum, albums: contextAlbums } = useGeoPhotos();

  const [photo, setPhoto] = useState<(GeoPhoto & { albumName?: string | null }) | null>(null);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');

  const displayAlbums = useMemo(() => {
    const map = new Map<number, AlbumItem>();
    albums.forEach((a) => map.set(a.id, a));
    contextAlbums.forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [albums, contextAlbums]);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const [photoData, albumList] = await Promise.all([
          getPhotoById(id),
          getAlbums(),
        ]);
        if (photoData) {
          setPhoto(photoData);
          setNoteText(photoData.note ?? '');
          setIsFavorite(photoData.favorite ?? false);
          setSelectedAlbumId(photoData.albumId ?? null);
        }
        setAlbums(albumList);
      } catch (e) {
        console.warn('Error al cargar detalle de foto:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.notFoundText}>Foto no encontrada</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  // Toggle Favorito
  const handleToggleFavorite = async () => {
    if (!photo) return;
    const nextVal = !isFavorite;
    setIsFavorite(nextVal);
    await setFavorite(photo.id, nextVal);
    await refresh();
  };

  // Crear nuevo álbum y asignarlo inmediatamente
  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) {
      Alert.alert('Atención', 'El nombre del álbum no puede estar vacío.');
      return;
    }
    try {
      const created = await addAlbum(newAlbumName.trim());
      setAlbums((prev) => {
        if (prev.some((a) => a.id === created.id)) return prev;
        return [...prev, created];
      });
      setSelectedAlbumId(created.id);
      if (photo) {
        await setAlbum(photo.id, created.id);
      }
      setNewAlbumName('');
      setIsModalOpen(false);
      Alert.alert('Álbum Asignado', `Foto asignada al nuevo álbum "${created.name}".`);
    } catch {
      Alert.alert('Error', 'Ya existe un álbum con ese nombre o hubo un error.');
    }
  };

  // Guardar Foto (nota + álbum + favorito) y volver a la ventana de inicio
  const handleSaveNote = async () => {
    if (!photo) return;
    setSaving(true);
    try {
      await Promise.all([
        setNote(photo.id, noteText.trim().length > 0 ? noteText.trim() : null),
        setAlbum(photo.id, selectedAlbumId),
        setFavorite(photo.id, isFavorite),
      ]);
      await refresh();
      Alert.alert(
        'Éxito',
        'La foto se guardó exitosamente con sus cambios.',
        [
          {
            text: 'Aceptar',
            onPress: () => {
              router.replace('/(tabs)/geocam');
            },
          },
        ],
        {
          cancelable: false,
        }
      );
    } catch {
      Alert.alert('Error', 'No se pudo guardar la foto.');
    } finally {
      setSaving(false);
    }
  };

  // Cambiar Álbum
  const handleSelectAlbum = (albumId: number | null) => {
    setSelectedAlbumId(albumId);
  };

  // Eliminar con confirmación
  const handleDelete = () => {
    Alert.alert(
      '¿Eliminar foto?',
      'Esta acción eliminará permanentemente la foto de la base de datos y de la memoria del teléfono.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removePhoto(photo.id);
              await refresh();
              router.back();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la foto.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 24) + 20,
        },
      ]}
    >
      {/* Header con botón regresar */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>Detalle de Foto</Text>
        <Pressable onPress={handleToggleFavorite} style={styles.iconBtn}>
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={26}
            color={isFavorite ? '#ef4444' : '#ffffff'}
          />
        </Pressable>
      </View>

      {/* Imagen Principal */}
      <View style={styles.imageCard}>
        <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" />
      </View>

      {/* Metadatos */}
      <View style={styles.metaCard}>
        <Text style={styles.metaRow}>
          <Text style={styles.metaLabel}>Origen: </Text>
          {photo.source === 'camera' ? 'Cámara' : 'Galería'}
        </Text>
        <Text style={styles.metaRow}>
          <Text style={styles.metaLabel}>Fecha: </Text>
          {new Date(photo.createdAt).toLocaleString()}
        </Text>
        <Text style={styles.metaRow}>
          <Text style={styles.metaLabel}>Coordenadas: </Text>
          {photo.coords
            ? `${photo.coords.latitude.toFixed(5)}, ${photo.coords.longitude.toFixed(5)} (±${Math.round(photo.coords.accuracy ?? 0)}m)`
            : 'Sin coordenadas (Ubicación denegada)'}
        </Text>
      </View>

      {/* Botón de Favorito destacado */}
      <Pressable
        onPress={handleToggleFavorite}
        style={[
          styles.favoriteCard,
          isFavorite && styles.favoriteCardActive,
        ]}
      >
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={22}
          color={isFavorite ? '#ef4444' : '#a3a3a3'}
        />
        <Text style={[styles.favoriteCardText, isFavorite && styles.favoriteCardTextActive]}>
          {isFavorite ? 'Foto Marcada como Favorita' : 'Agregar a Favoritos'}
        </Text>
      </Pressable>

      {/* Sección Editar Nota */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nota descriptiva:</Text>
        <TextInput
          style={styles.input}
          placeholder="Escribe una nota para esta foto..."
          placeholderTextColor="#737373"
          value={noteText}
          onChangeText={setNoteText}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Sección Asignar a un Álbum */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Álbum asignado:</Text>
          <Pressable
            onPress={() => setIsModalOpen(true)}
            style={styles.createAlbumBtn}
          >
            <Ionicons name="add-circle-outline" size={18} color="#10b981" />
            <Text style={styles.createAlbumBtnText}>Nuevo Álbum</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumScroll}>
          <Pressable
            onPress={() => handleSelectAlbum(null)}
            style={[styles.albumChip, selectedAlbumId === null && styles.albumChipActive]}
          >
            <Text
              style={[
                styles.albumChipText,
                selectedAlbumId === null && styles.albumChipTextActive,
              ]}
            >
              Sin Álbum
            </Text>
          </Pressable>

          {displayAlbums.map((alb) => (
            <Pressable
              key={alb.id}
              onPress={() => handleSelectAlbum(alb.id)}
              style={[styles.albumChip, selectedAlbumId === alb.id && styles.albumChipActive]}
            >
              <Ionicons
                name="folder"
                size={14}
                color={selectedAlbumId === alb.id ? '#0a0a0a' : '#10b981'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.albumChipText,
                  selectedAlbumId === alb.id && styles.albumChipTextActive,
                ]}
              >
                {alb.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Botón Guardar Foto y volver al inicio */}
      <Pressable
        onPress={handleSaveNote}
        disabled={saving}
        style={({ pressed }) => [styles.saveBtn, pressed && styles.btnPressed]}
      >
        <Ionicons name="checkmark-circle-outline" size={20} color="#0a0a0a" style={{ marginRight: 8 }} />
        <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar Foto y Álbum'}</Text>
      </Pressable>

      {/* Botón Eliminar con confirmación */}
      <Pressable
        onPress={handleDelete}
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.btnPressed]}
      >
        <Ionicons name="trash" size={20} color="#ef4444" />
        <Text style={styles.deleteBtnText}>Eliminar Foto Permanentemente</Text>
      </Pressable>

      {/* Modal para crear nuevo álbum */}
      <Modal
        visible={isModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear Nuevo Álbum</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa el nombre del álbum para asignarlo a esta foto:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Paisajes, Trabajo, etc."
              placeholderTextColor="#737373"
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setNewAlbumName('');
                  setIsModalOpen(false);
                }}
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleCreateAlbum} style={styles.modalBtnConfirm}>
                <Text style={styles.modalBtnTextConfirm}>Crear y Asignar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingHorizontal: 16 },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  iconBtn: { padding: 8 },
  imageCard: {
    width: '100%',
    height: 320,
    backgroundColor: '#171717',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: { width: '100%', height: '100%' },
  metaCard: {
    backgroundColor: '#171717',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  metaRow: { color: '#d4d4d4', fontSize: 14 },
  metaLabel: { color: '#10b981', fontWeight: 'bold' },
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#262626',
    gap: 10,
  },
  favoriteCardActive: {
    backgroundColor: '#261215',
    borderColor: '#ef4444',
  },
  favoriteCardText: {
    color: '#a3a3a3',
    fontSize: 15,
    fontWeight: 'bold',
  },
  favoriteCardTextActive: {
    color: '#ef4444',
  },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  input: {
    backgroundColor: '#171717',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: '#0a0a0a', fontWeight: 'bold', fontSize: 15 },
  btnPressed: { opacity: 0.8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  createAlbumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#17252a',
    gap: 4,
  },
  createAlbumBtnText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  albumScroll: { flexDirection: 'row', marginTop: 4 },
  albumChip: {
    backgroundColor: '#262626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#404040',
  },
  albumChipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  albumChipText: { color: '#d4d4d4', fontSize: 14 },
  albumChipTextActive: { color: '#0a0a0a', fontWeight: 'bold' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f1315',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  deleteBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },
  notFoundText: { color: '#ef4444', fontSize: 18, marginBottom: 12 },
  backBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: { color: '#000000', fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#a3a3a3',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  modalBtnConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
  },
  modalBtnTextCancel: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  modalBtnTextConfirm: {
    color: '#000000',
    fontWeight: 'bold',
  },
});

