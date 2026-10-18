// lib/supabase.ts
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.warn(
    'Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env. Configure sus credenciales.'
  );
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-key',
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // No hay URL de navegador en una app nativa
    },
  }
);

// El token solo se refresca mientras la app está en primer plano
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

