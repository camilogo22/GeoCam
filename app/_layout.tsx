// app/_layout.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';
import { GeoPhotosProvider } from '@/context/GeoPhotosContext';
import { photosRepo } from '@/db/repositories/photos';

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="photo/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const isWeb = Platform.OS === 'web';
  const { success, error } = isWeb
    ? { success: true, error: null }
    : useMigrations(db, migrations);

  // Rellena clientId y updatedAt en fotos previas una vez ejecutada la migración
  useEffect(() => {
    if (success && !isWeb) {
      photosRepo.ensureSyncFields().catch((err) => {
        console.warn('Error ejecutando ensureSyncFields():', err);
      });
    }
  }, [success, isWeb]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0a0a0a',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <Text style={{ color: '#ef4444', fontSize: 16, textAlign: 'center' }}>
          Error aplicando migraciones SQLite: {error.message}
        </Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0a0a0a',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <GeoPhotosProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </GeoPhotosProvider>
  );
}
