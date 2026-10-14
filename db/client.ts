// db/client.ts
import { Platform } from 'react-native';
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const isWeb = Platform.OS === 'web';

let expoDbInstance: any;
let dbInstance: any;

if (!isWeb) {
  // Abre la base de datos con enableChangeListener para reactividad en consultas
  expoDbInstance = openDatabaseSync('geocam.db', { enableChangeListener: true });
  // Activa el cumplimiento de llaves foráneas en SQLite
  expoDbInstance.execSync('PRAGMA foreign_keys = ON;');
  dbInstance = drizzle(expoDbInstance, { schema });
} else {
  // En Web o navegadores sin soporte WASM/SharedArrayBuffer, inicializamos de forma segura
  try {
    expoDbInstance = openDatabaseSync('geocam.db', { enableChangeListener: true });
    expoDbInstance.execSync('PRAGMA foreign_keys = ON;');
    dbInstance = drizzle(expoDbInstance, { schema });
  } catch (e) {
    console.warn('SQLite no está habilitado en este navegador web (se requiere iOS/Android o SharedArrayBuffer).', e);
    expoDbInstance = { execSync: () => {} };
    dbInstance = {
      select: () => ({
        from: () => ({
          where: () => ({ orderBy: () => Promise.resolve([]) }),
          orderBy: () => Promise.resolve([]),
        }),
      }),
      insert: () => ({ values: () => Promise.resolve() }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      delete: () => ({ where: () => Promise.resolve() }),
    };
  }
}

export const expoDb = expoDbInstance;
export const db: ReturnType<typeof drizzle<typeof schema>> = dbInstance;


