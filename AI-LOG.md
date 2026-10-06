# Registro de Auditoria de Inteligencia Artificial (AI-LOG)

> **Materia:** Desarrollo Movil — Taller Integrador 2  
> **Semana:** 7 — Base de Datos Local Offline-First con Drizzle ORM y SQLite  
> **Proyecto:** GeoCam Persistente  
> **Estudiante:** **Camilo Gomez**  
> **Docente de referencia:** @AntonioJGL  
> **Ecosistema:** Expo SDK 57 | Drizzle ORM | Expo SQLite | TypeScript

---

> [!NOTE]
> Este documento registra la auditoria tecnica realizada sobre el codigo asistido por IA durante el desarrollo del modulo de persistencia local offline-first con Drizzle ORM y SQLite en GeoCam. Se documentan las alucinaciones detectadas, diferencias entre codigo generado y corregido, y la matriz de validacion de APIs de bases de datos embebidas.

---

## 1. Prompts Utilizados y Objetivos Tecnicos

| # | Prompt Ejecutado | Objetivo Tecnico | Resultado Obtenido |
| :---: | :--- | :--- | :--- |
| **P1** | *"Crea con Drizzle ORM y expo-sqlite una tabla albums relacionada con photos, de forma que al borrar un album las fotos no se eliminen."* | Definir esquemas relacionales con llave foranea opcional y regla de eliminacion ON DELETE SET NULL. | La IA propuso el esquema pero configuro onDelete: 'cascade', lo cual destruiria las fotos al eliminar el album. |
| **P2** | *"Genera una segunda migracion en Drizzle ORM que agregue las columnas note y favorite con valor por defecto false sin perder los datos existentes."* | Modificar el esquema para admitir notas y favoritas, generando migraciones incrementales automáticas con drizzle-kit generate. | La IA intento ejecutar drizzle-kit push en lugar de generar archivos SQL locales para el migrador movil. |
| **P3** | *"Como implementar persistencia fisica de fotos en la carpeta de documentos de la app con expo-file-system y eliminar el archivo cuando se borre en SQLite."* | Evitar depender de URIs temporales de cache y garantizar limpieza de archivos huerfanos al borrar registros. | La IA mezclo clases de la nueva API (File, Directory) con metodos de la API legacy (FileSystem.copyAsync). |

---

## 2. Analisis Comparativo: Codigo Generado vs. Codigo Modificado

### 2.1 Relacion entre Albums y Photos (`db/schema.ts`)

> [!WARNING]
> **Deficiencia de la IA:** La IA genero la relacion foranea con `onDelete: 'cascade'`. Esto viola directamente el requisito C1, ya que al eliminar un album se eliminarian todas las fotos asociadas. Ademas, omitio configurar el `PRAGMA foreign_keys = ON;` en la conexion SQLite, lo que hace que SQLite ignore cualquier regla de integridad referencial.

#### Codigo Inicial Propuesto por la IA:

```typescript
// Codigo generado inicialmente por la IA (Inseguro para fotos)
export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  uri: text('uri').notNull(),
  albumId: integer('album_id')
    .notNull()
    .references(() => albums.id, { onDelete: 'cascade' }), // Borra las fotos si se borra el album
});
```

#### Codigo Final Modificado y Corregido:

```typescript
// Codigo refactorizado y corregido segun requisito C1
export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  uri: text('uri').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracy: real('accuracy'),
  source: text('source', { enum: ['camera', 'gallery'] }).notNull().default('camera'),
  createdAt: integer('created_at').notNull(),
  albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }), // Fotos quedan sin album
  note: text('note'),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
});

// En db/client.ts:
export const expoDb = openDatabaseSync('geocam.db', { enableChangeListener: true });
expoDb.execSync('PRAGMA foreign_keys = ON;'); // Obliga a SQLite a respetar llaves foraneas
```

---

### 2.2 Persistencia de Archivos Fisicos (`services/photoFiles.ts`)

> [!IMPORTANT]
> **Regla de Persistencia:** Las fotos tomadas con la camara se guardan inicialmente en el directorio de cache temporal del sistema operativo, el cual puede ser purgado cuando el dispositivo tiene poco espacio. Para persistencia permanente deben copiarse a `Paths.document` y registrar la nueva ruta en SQLite.

#### Codigo Inicial Propuesto por la IA:

```typescript
// Mezcla de API antigua y nueva producida por la IA
import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';

export async function persistPhoto(uri: string) {
  const dest = FileSystem.documentDirectory + 'photo.jpg';
  await FileSystem.copyAsync({ from: uri, to: dest }); // Metodo legacy
}
```

#### Codigo Final Modificado y Corregido:

```typescript
// Implementacion consistente con las clases modernas de Expo SDK 57
import { Directory, File, Paths } from 'expo-file-system';

const photosDir = new Directory(Paths.document, 'photos');

export function persistPhoto(cacheUri: string): string {
  if (!photosDir.exists) photosDir.create();
  const source = new File(cacheUri);
  const destination = new File(photosDir, `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`);
  source.copy(destination);
  return destination.uri;
}

export function deletePhotoFile(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}
```

---

## 3. Catalogo Detallado de Alucinaciones y Errores Detectados

### Caso 1: Driver de Base de Datos para Servidor en Entorno Movil
* **Alucinacion:** `import { drizzle } from 'drizzle-orm/better-sqlite3'`.
* **Causa:** Los modelos de IA asumen por defecto el entorno Node.js para SQLite. `better-sqlite3` es una libreria compilada en C++ nativo para servidores que no puede ejecutarse dentro de los motores JavaScript de React Native / Hermes.
* **Correccion:** Uso exclusivo de `drizzle-orm/expo-sqlite` junto con `openDatabaseSync` de `expo-sqlite`.

### Caso 2: Intento de Ejecutar drizzle-kit push en Dispositivo Embebido
* **Alucinacion:** La IA indico ejecutar `npx drizzle-kit push` para aplicar los cambios de las tablas.
* **Causa:** `drizzle-kit push` requiere una conexion TCP viva contra un servidor de base de datos. En un telefono celular, la base de datos es un archivo local embebido en el almacenamiento seguro de la aplicacion.
* **Correccion:** Se genero el historial de migraciones SQL con `npx drizzle-kit generate` y se aplicaron en el arranque de la aplicacion mediante el hook oficial `useMigrations(db, migrations)` en `app/_layout.tsx`.

### Caso 3: Omision de enableChangeListener en la Apertura de SQLite
* **Alucinacion:** `const db = openDatabaseSync('geocam.db');` sin opciones adicionales.
* **Impacto:** Provoca que los hooks y consultas reactivas no reciban notificaciones de cambios cuando ocurren operaciones concurrentes de insercion o eliminacion.
* **Correccion:** Apertura explícita con `openDatabaseSync('geocam.db', { enableChangeListener: true })`.

### Caso 4: Inoperancia de Llaves Foraneas por Omision de PRAGMA
* **Alucinacion:** Definir relaciones en Drizzle asumiendo que SQLite hace cumplir las restricciones por defecto.
* **Impacto:** En el motor C de SQLite, el soporte de llaves foraneas viene deshabilitado por compatibilidad historica (`PRAGMA foreign_keys = OFF`). Sin activarlo, al borrar un album la columna `albumId` de las fotos conservaba el ID borrado en lugar de colocarse en `NULL`.
* **Correccion:** Ejecucion de `expoDb.execSync('PRAGMA foreign_keys = ON;')` inmediatamente despues de abrir la base de datos.

### Caso 5: Mezcla de Metodos Asincronos Legacy con Clases Nuevas de FileSystem
* **Alucinacion:** Uso simultaneo de `FileSystem.copyAsync()` con `new File()`.
* **Correccion:** Adopcion uniforme de la API moderna basada en clases (`Directory`, `File`, `Paths`) disponible en el SDK 57 de Expo.

---

## 4. Matriz Oficial de Auditoria: Codigo IA vs. Estandar Drizzle y SQLite

| Caracteristica / API | Generado por la IA | Problema Tecnico | Estandar Oficial Implementado |
| :--- | :--- | :--- | :--- |
| **Driver ORM** | `drizzle-orm/better-sqlite3` | Modulo nativo de Node.js, falla en celular | `drizzle-orm/expo-sqlite` |
| **Apertura de Conexion** | `openDatabase('db')` | API deprecada y retirada de expo-sqlite | `openDatabaseSync('geocam.db', { enableChangeListener: true })` |
| **Aplicacion de Esquema** | `npx drizzle-kit push` | Incompatible con bases locales sin servidor | `npx drizzle-kit generate` + `useMigrations()` |
| **Configuracion Drizzle** | `drizzle.config.ts` sin driver expo | No genera migrations.js empaquetado | `driver: 'expo'`, `dialect: 'sqlite'` |
| **Integridad Referencial** | Omitir PRAGMA foreign_keys | SQLite ignora onDelete: 'set null' | `expoDb.execSync('PRAGMA foreign_keys = ON;')` |
| **Persistencia de Archivos** | `FileSystem.copyAsync` mixto | Mezcla de modulos legacy con clases nuevas | Clases unificadas `Directory`, `File` y `Paths` |
| **Filtros Reactivos** | Filtros en memoria sin LIKE SQL | Mal rendimiento en colecciones grandes | Consultas parametrizadas con `like()`, `eq()` y `isNull()` |

---

## 5. Conclusiones y Aprendizajes

1. **Las migraciones deben ser inmutables:** En bases de datos embebidas locales, nunca se debe editar un archivo `.sql` de migracion generado a mano. Cada cambio de esquema (como anadir `note` y `favorite`) debe corresponder a un nuevo archivo de migracion (`0000`, `0001`) generado por el CLI para preservar los datos de los usuarios.
2. **Las llaves foraneas en SQLite requieren activacion manual:** A diferencia de PostgreSQL o MySQL, SQLite exige ejecutar explícitamente `PRAGMA foreign_keys = ON;` al abrir cada conexion para garantizar que reglas como `ON DELETE SET NULL` funcionen.
3. **Persistencia dual (Metadatos + Archivos):** Una aplicacion offline-first robusta debe sincronizar el ciclo de vida del registro en la base de datos con el ciclo de vida del archivo en disco. Al eliminar una foto de SQLite, debe removerse simultaneamente el archivo fisico para no consumir almacenamiento huerfano en el dispositivo.
