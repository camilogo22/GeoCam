// lib/supabase.ts
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const DEFAULT_SUPABASE_URL = 'https://xrsajlzauklhnyekuuks.supabase.co';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
// Si el URL en .env no está o contiene placeholders como "xxxxxxxx" o "placeholder", usar el URL real del proyecto
export const supabaseUrl =
  rawUrl && !rawUrl.includes('xxxxxxxx') && !rawUrl.includes('placeholder')
    ? rawUrl
    : DEFAULT_SUPABASE_URL;

export const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || '';

export const supabase = createClient(
  supabaseUrl,
  supabaseKey || 'placeholder-key',
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
