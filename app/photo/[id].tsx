// app/photo/[id].tsx
import React, { useState, useEffect } from 'react';
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
  const { setNote, setFavorite, setAlbum, removePhoto, refresh } = useGeoPhotos();

  const [photo, setPhoto] = useState<(GeoPhoto & { albumName?: string | null }) | null>(null);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // Guardar Foto y volver a la ventana de inicio
  const handleSaveNote = async () => {
    if (!photo) return;
    setSaving(true);
    try {
      await setNote(photo.id, noteText.trim().length > 0 ? noteText.trim() : null);
      await refresh();
      Alert.alert(
        'Éxito',
        'La foto se guardó exitosamente.',
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
  const handleSelectAlbum = async (albumId: number | null) => {
    if (!photo) return;
    setSelectedAlbumId(albumId);
    await setAlbum(photo.id, albumId);
    await refresh();
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
        <Pressable
          onPress={handleSaveNote}
          disabled={saving}
          style={({ pressed }) => [styles.saveBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar Foto'}</Text>
        </Pressable>
      </View>

      {/* Sección Mover de Álbum */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Álbum asignado:</Text>
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
          {albums.map((alb) => (
            <Pressable
              key={alb.id}
              onPress={() => handleSelectAlbum(alb.id)}
              style={[styles.albumChip, selectedAlbumId === alb.id && styles.albumChipActive]}
            >
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

      {/* Botón Eliminar con confirmación */}
      <Pressable
        onPress={handleDelete}
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.btnPressed]}
      >
        <Ionicons name="trash" size={20} color="#ef4444" />
        <Text style={styles.deleteBtnText}>Eliminar Foto Permanentemente</Text>
      </Pressable>
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
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: '#0a0a0a', fontWeight: 'bold', fontSize: 15 },
  btnPressed: { opacity: 0.8 },
  albumScroll: { flexDirection: 'row', marginTop: 4 },
  albumChip: {
    backgroundColor: '#262626',
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
});

