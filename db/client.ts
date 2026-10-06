// db/client.ts
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

// Abre la base de datos con enableChangeListener para reactividad en consultas
export const expoDb = openDatabaseSync('geocam.db', { enableChangeListener: true });

// Activa el cumplimiento de llaves foráneas en SQLite
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });

