// lib/supabase.ts
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const DEFAULT_SUPABASE_URL = 'https://xrsajlzauklhnyekuuks.supabase.co';
const DEFAULT_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhyc2FqbHphdWtsaG55ZWt1dWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNDM3NTksImV4cCI6MjEwNzkxOTc1OX0.BnJCoM84CFQE0y-R7O2DJvRxadlwRjClZZ-PyIdYp1Y';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
// Si el URL en .env no está o contiene placeholders como "xxxxxxxx" o "placeholder", usar el URL real del proyecto
export const supabaseUrl =
  rawUrl && !rawUrl.includes('xxxxxxxx') && !rawUrl.includes('placeholder')
    ? rawUrl
    : DEFAULT_SUPABASE_URL;

const rawKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
// Si la clave en .env no está o contiene placeholders como "xxxxxxxx" o "placeholder", usar la anon key real
export const supabaseKey =
  rawKey && !rawKey.includes('xxxxxxxx') && !rawKey.includes('placeholder')
    ? rawKey
    : DEFAULT_SUPABASE_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
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
