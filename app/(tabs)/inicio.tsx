// app/(tabs)/inicio.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useAuth } from '@/context/AuthContext';
import { syncPendingPhotos } from '@/services/cloudPhotos';

export default function InicioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { photos, albums, refresh } = useGeoPhotos();
  const { user, signOut } = useAuth();

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  // Estadísticas rápidas
  const totalPhotos = photos.length;
  const favoritePhotos = photos.filter((p) => p.favorite).length;
  const gpsPhotos = photos.filter((p) => p.coords !== null).length;
  const totalAlbums = albums.length;
  const pendingPhotos = photos.filter(
    (p) => !p.syncedAt || (p.updatedAt && p.updatedAt > p.syncedAt)
  );
  const syncedPhotos = photos.filter(
    (p) => p.syncedAt && (!p.updatedAt || p.syncedAt >= p.updatedAt)
  );

  const handleSyncAll = async () => {
    if (!user?.id) {
      Alert.alert('Sesión Requerida', 'Debes iniciar sesión para sincronizar fotos con Supabase.');
      return;
    }
    if (pendingPhotos.length === 0) {
      Alert.alert('Al día', 'Todas tus fotos ya están sincronizadas con la nube.');
      return;
    }

    setIsSyncingAll(true);
    setSyncProgress({ current: 0, total: pendingPhotos.length });

    try {
      const result = await syncPendingPhotos(photos, user.id, (current, total) => {
        setSyncProgress({ current, total });
      });
      await refresh();
      Alert.alert(
        'Sincronización Completa',
        `Fotos sincronizadas con éxito: ${result.uploaded}\nFallos: ${result.failed}`
      );
    } catch (err: any) {
      Alert.alert('Error al sincronizar', err?.message || 'Ocurrió un error inesperado al subir las fotos.');
    } finally {
      setIsSyncingAll(false);
      setSyncProgress(null);
    }
  };

  // Últimas fotos capturadas (máximo 6)
  const recentPhotos = photos.slice(0, 6);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 16) + 12,
          paddingBottom: Math.max(insets.bottom, 24) + 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Principal con perfil de usuario y botón de cerrar sesión */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.logoContainer}>
            <Ionicons name="camera" size={26} color="#10b981" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.appName}>GeoCam Cloud</Text>
            <Text style={styles.appTagline}>{user?.email ? user.email : 'Cámara y Galería Geolocalizada'}</Text>
          </View>
          <Pressable
            onPress={signOut}
            style={({ pressed }) => [
              styles.signOutBtn,
              pressed && { opacity: 0.75 },
            ]}
            hitSlop={8}
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </Pressable>
        </View>

        {/* Badge de estado Offline-First & Cloud */}
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>SQLite · Drizzle ORM · Supabase</Text>
        </View>
      </View>

      {/* Breve descripción de qué hace GeoCam */}
      <View style={styles.aboutCard}>
        <View style={styles.aboutHeaderRow}>
          <Ionicons name="information-circle-outline" size={20} color="#10b981" />
          <Text style={styles.aboutTitle}>¿Qué hace GeoCam?</Text>
        </View>
        <Text style={styles.aboutDescription}>
          GeoCam combina tu cámara con sensores GPS para capturar fotografías y geolocalizarlas automáticamente en un mapa interactivo. Te permite organizar tus fotos en álbumes, destacar tus favoritas, añadir notas personalizadas y almacenar todo de forma rápida y segura en tu dispositivo con SQLite.
        </Text>
      </View>

      {/* Banner de Sincronización con Supabase (Semana 8) */}
      {pendingPhotos.length > 0 && (
        <View style={styles.syncBanner}>
          <View style={styles.syncBannerLeft}>
            <View style={styles.syncBannerIcon}>
              <Ionicons name="cloud-upload" size={20} color="#f59e0b" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.syncBannerTitle}>
                {pendingPhotos.length} foto{pendingPhotos.length === 1 ? '' : 's'} por sincronizar
              </Text>
              <Text style={styles.syncBannerSubtitle}>
                {isSyncingAll && syncProgress
                  ? `Sincronizando ${syncProgress.current} de ${syncProgress.total}...`
                  : 'Sube tus fotos a Supabase Storage privado'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleSyncAll}
            disabled={isSyncingAll}
            style={({ pressed }) => [
              styles.syncNowBtn,
              pressed && { opacity: 0.8 },
              isSyncingAll && { opacity: 0.6 },
            ]}
          >
            {isSyncingAll ? (
              <ActivityIndicator size="small" color="#0a0a0a" />
            ) : (
              <Text style={styles.syncNowBtnText}>Sincronizar</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Grid de Estadísticas */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="images-outline" size={22} color="#10b981" />
          <Text style={styles.statNumber}>{totalPhotos}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="cloud-done-outline" size={22} color="#06b6d4" />
          <Text style={styles.statNumber}>{syncedPhotos.length}</Text>
          <Text style={styles.statLabel}>En Nube</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="heart" size={22} color="#ef4444" />
          <Text style={styles.statNumber}>{favoritePhotos}</Text>
          <Text style={styles.statLabel}>Favoritas</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="location-outline" size={22} color="#f59e0b" />
          <Text style={styles.statNumber}>{gpsPhotos}</Text>
          <Text style={styles.statLabel}>Con GPS</Text>
        </View>
      </View>

      {/* Acciones Rápidas */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
      </View>

      {/* Tarjeta Destacada: Abrir Cámara */}
      <Pressable
        onPress={() => router.push('/(tabs)/geocam')}
        style={({ pressed }) => [styles.actionHeroCard, pressed && styles.cardPressed]}
      >
        <View style={styles.heroLeft}>
          <View style={styles.heroIconBox}>
            <Ionicons name="camera" size={32} color="#0a0a0a" />
          </View>
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={styles.heroTitle}>Tomar Foto GeoCam</Text>
            <Text style={styles.heroSubtitle}>
              Captura fotos con coordenadas GPS y guarda en SQLite
            </Text>
          </View>
        </View>
        <Ionicons name="arrow-forward" size={22} color="#10b981" />
      </Pressable>

      <View style={styles.dualActionRow}>
        {/* Ir a Galería */}
        <Pressable
          onPress={() => router.push('/(tabs)/galeria')}
          style={({ pressed }) => [styles.subActionCard, pressed && styles.cardPressed]}
        >
          <View style={[styles.subIconBox, { backgroundColor: '#1e293b' }]}>
            <Ionicons name="images" size={22} color="#38bdf8" />
          </View>
          <Text style={styles.subActionTitle}>Galería</Text>
          <Text style={styles.subActionDesc}>Buscar, filtrar y favoritos</Text>
        </Pressable>

        {/* Ir al Mapa */}
        <Pressable
          onPress={() => router.push('/(tabs)/mapa')}
          style={({ pressed }) => [styles.subActionCard, pressed && styles.cardPressed]}
        >
          <View style={[styles.subIconBox, { backgroundColor: '#2e1065' }]}>
            <Ionicons name="map" size={22} color="#a855f7" />
          </View>
          <Text style={styles.subActionTitle}>Mapa GPS</Text>
          <Text style={styles.subActionDesc}>Explorar fotos en el mapa</Text>
        </Pressable>
      </View>

      {/* Álbumes Creados */}
      {albums.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tus Álbumes ({albums.length})</Text>
            <Pressable onPress={() => router.push('/(tabs)/galeria')}>
              <Text style={styles.seeAllText}>Ver todos</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumRow}>
            {albums.map((alb) => (
              <Pressable
                key={alb.id}
                onPress={() => router.push('/(tabs)/galeria')}
                style={styles.albumPill}
              >
                <Ionicons name="folder" size={16} color="#10b981" style={{ marginRight: 6 }} />
                <Text style={styles.albumPillText}>{alb.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Fotos Recientes */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fotos Recientes</Text>
          {recentPhotos.length > 0 && (
            <Pressable onPress={() => router.push('/(tabs)/galeria')}>
              <Text style={styles.seeAllText}>Ver galería</Text>
            </Pressable>
          )}
        </View>

        {recentPhotos.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="camera-outline" size={44} color="#525252" />
            <Text style={styles.emptyTitle}>Aún no tienes fotos</Text>
            <Text style={styles.emptySubtitle}>
              Presiona el botón de la cámara para capturar tu primera foto geolocalizada.
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/geocam')}
              style={styles.emptyBtn}
            >
              <Text style={styles.emptyBtnText}>Abrir Cámara</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.recentGrid}>
            {recentPhotos.map((photo) => (
              <Pressable
                key={photo.id}
                onPress={() => router.push(`/photo/${photo.id}`)}
                style={({ pressed }) => [styles.recentCard, pressed && styles.cardPressed]}
              >
                <Image source={{ uri: photo.uri }} style={styles.recentImage} />
                {photo.favorite && (
                  <View style={styles.recentFavoriteBadge}>
                    <Ionicons name="heart" size={12} color="#ef4444" />
                  </View>
                )}
                {photo.coords && (
                  <View style={styles.recentGpsBadge}>
                    <Ionicons name="location" size={10} color="#10b981" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#17252a',
    borderWidth: 1,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  appTagline: {
    fontSize: 13,
    color: '#a3a3a3',
    marginTop: 2,
  },
  signOutBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1f1315',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#14251e',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#065f46',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#262626',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  aboutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  aboutTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  aboutDescription: {
    fontSize: 13,
    color: '#d4d4d4',
    lineHeight: 19,
  },
  syncBanner: {
    backgroundColor: '#1c150c',
    borderWidth: 1,
    borderColor: '#d97706',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  syncBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#451a03',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  syncBannerSubtitle: {
    fontSize: 11,
    color: '#d4d4d4',
    marginTop: 2,
  },
  syncNowBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  syncNowBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#171717',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#a3a3a3',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  seeAllText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
  },
  actionHeroCard: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#10b981',
    marginBottom: 12,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  heroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#a3a3a3',
    marginTop: 3,
    lineHeight: 16,
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  subActionCard: {
    flex: 1,
    backgroundColor: '#171717',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#262626',
  },
  subIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  subActionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subActionDesc: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  albumRow: {
    flexDirection: 'row',
  },
  albumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#262626',
  },
  albumPillText: {
    color: '#e5e5e5',
    fontSize: 13,
    fontWeight: '500',
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentCard: {
    width: (Dimensions.get('window').width - 32 - 16) / 3,
    height: (Dimensions.get('window').width - 32 - 16) / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#171717',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#262626',
  },
  recentImage: {
    width: '100%',
    height: '100%',
  },
  recentFavoriteBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    padding: 3,
  },
  recentGpsBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    padding: 3,
  },
  emptyState: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  emptySubtitle: {
    color: '#737373',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: {
    color: '#0a0a0a',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardPressed: {
    opacity: 0.8,
  },
});

