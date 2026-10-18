# GeoCam Persistente — Modulo CRUD con Drizzle ORM y SQLite

Aplicacion movil desarrollada con **Expo**, **React Native**, **TypeScript**, **Drizzle ORM** y **Expo SQLite** para el Taller Integrador de la Semana 7.

**Desarrollador:** Camilo Gomez  
**Semana:** 7 — Base de Datos Local Offline-First con Drizzle ORM y SQLite  
**Repositorio:** [https://github.com/camilogo22/GeoCam](https://github.com/camilogo22/GeoCam)  

---

## Caracteristicas Principales

- **Base de Datos Embebida Offline-First**: Implementacion completa con `expo-sqlite` y `drizzle-orm/expo-sqlite`, ejecutando con `PRAGMA foreign_keys = ON;` y `enableChangeListener: true`.
- **Relaciones y Llaves Foraneas (C1)**: Tabla `albums` relacionada con `photos` mediante la columna `albumId`. Regla `onDelete: 'set null'` para que al borrar un album sus fotos queden sin album pero no se eliminen.
- **Historial de Migraciones Versionadas (C2)**:
  - Migracion `0000_sturdy_omega_sentinel.sql`: Tablas iniciales `albums` y `photos`.
  - Migracion `0001_flippant_retro_girl.sql`: Adicion incremental de columnas `note` (texto) y `favorite` (booleano) preservando los datos existentes.
- **CRUD Completo de Fotos (C3)**: Pantalla dedicada `app/photo/[id].tsx` para ver metadatos y coordenadas, editar notas, alternar estado favorito, reasignar album y eliminar con confirmacion.
- **Busqueda y Filtros Reactivos (C4)**: Pantalla `app/(tabs)/galeria.tsx` con buscador en vivo por nota (operador `like`), filtro por favoritas y selector de albumes.
- **Persistencia Fisica en Documentos (C5)**: Modulo `services/photoFiles.ts` que copia fotos desde la cache temporal a la carpeta de documentos permanentes (`Paths.document`) y elimina el archivo fisico al borrar el registro de SQLite.
- **Modulos Nativos y Sensores**: Camara nativa (`expo-camera`), mapa interactivo (`react-native-maps`), acelerometro (`expo-sensors`) y geolocalizacion (`expo-location`).

---

## Capturas de Ejecucion en Dispositivo Fisico

| Pantalla Principal (Inicio) | Galería y Álbumes | Mapa GPS Interactiva |
| :---: | :---: | :---: |
| <img src="screenshots/inicio.jpg" width="260" alt="Pantalla Inicio GeoCam" /> | <img src="screenshots/galeria.jpg" width="260" alt="Galería y Álbumes GeoCam" /> | <img src="screenshots/mapa.jpg" width="260" alt="Mapa GPS Riohacha GeoCam" /> |
| *Estadísticas de fotos, estado SQLite & Drizzle activo y fotos recientes.* | *Buscador por notas, filtro por álbumes ("clase") y fotos guardadas.* | *Detección de ubicación GPS y visualización en mapa (Riohacha, Colombia).* |

---

## Diagrama de Tablas de la Base de Datos

```text
+-----------------------------------+             +-----------------------------------+
|              albums               |             |              photos               |
+-----------------------------------+             +-----------------------------------+
| id: integer (PK, AutoIncrement)   |<------------| id: text (PK)                     |
| name: text (Unique, Not Null)     |  1       0..*| uri: text (Not Null)             |
| created_at: integer (Not Null)    |             | latitude: real                    |
+-----------------------------------+             | longitude: real                   |
                                                  | accuracy: real                    |
                                                  | source: text (camera/gallery)     |
                                                  | created_at: integer (Not Null)    |
                                                  | album_id: integer (FK, Set Null)  |
                                                  | note: text (Nullable)             |
                                                  | favorite: integer (Boolean, 0)    |
                                                  +-----------------------------------+
```

### Relacion:
- Un album puede contener de 0 a muchas fotos (`1` a `0..*`).
- Una foto pertenece opcionalmente a un album (`album_id` nullable).
- Regla referencial: `ON DELETE SET NULL`. Al eliminar un registro en `albums`, las fotos asociadas actualizan su campo `album_id` a `NULL` sin borrarse.

---

## Estructura del Proyecto

```text
semana-7/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Pestañas: GeoCam, Galeria y Mapa
│   │   ├── geocam.tsx            # Pestaña 1: Camara, coordenadas y captura persistente
│   │   ├── galeria.tsx           # Pestaña 2: Busqueda por nota, filtros por album y favoritas
│   │   ├── mapa.tsx              # Pestaña 3: Mapa interactivo con marcadores y enlace a detalle
│   │   └── mapa.web.tsx          # Pestaña 3: Modo adaptado a navegador web
│   ├── photo/
│   │   └── [id].tsx              # Pantalla CRUD: Ver foto, editar nota, favorito, album y borrar
│   ├── _layout.tsx               # Root Layout con ejecucion de useMigrations()
│   └── index.tsx                 # Redireccion a /(tabs)/geocam
├── db/
│   ├── client.ts                 # Instancia de Drizzle ORM y activacion de PRAGMA foreign_keys
│   ├── schema.ts                 # Esquemas relacionales de albums y photos
│   └── repositories/
│       ├── photos.ts             # Consultas Drizzle listQuery, withLocationQuery y CRUD
│       └── albums.ts             # Consultas Drizzle de albumes
├── drizzle/                      # Carpeta versionada con migraciones SQL oficiales
│   ├── meta/
│   │   └── _journal.json         # Registro historico de migraciones
│   ├── 0000_sturdy_omega_sentinel.sql  # Migracion inicial: albums y photos
│   ├── 0001_flippant_retro_girl.sql    # Migracion 2: note y favorite
│   ├── 0002_great_scarecrow.sql        # Migracion 3: sync fields y user isolation (Semana 8)
│   └── migrations.js             # Indice de migraciones empaquetadas para Expo
├── lib/
│   ├── secureStorage.ts          # Adaptador seguro en chunks para Supabase Auth (Expo SecureStore)
│   └── supabase.ts               # Cliente Supabase singleton con auto-refresh y AppState
├── services/
│   ├── cloudPhotos.ts            # Sincronizacion con Supabase Storage privado y Postgres RLS
│   ├── photoFiles.ts             # Persistencia permanente en Paths.document y borrado fisico
│   └── photosRepository.ts       # Integracion de repositorios Drizzle, FileSystem y Cloud
├── hooks/
│   ├── usePhotos.ts              # Hook reactivo de fotos filtradas por ownerId con useLiveQuery
│   ├── useAlbums.ts              # Hook reactivo de albumes con useLiveQuery
│   ├── useCamera.ts              # Hook nativo de camara
│   ├── useGeoLocation.ts         # Hook nativo de GPS
│   └── useShake.ts               # Hook con acelerometro
├── context/
│   ├── AuthContext.tsx           # Proveedor de autenticacion Supabase (signIn, signUp, signOut)
│   └── GeoPhotosContext.tsx      # Proveedor global conectado a SQLite y sesion de usuario
├── supabase/
│   └── schema.sql                # Esquema PostgreSQL con RLS y politicas para bucket geocam
├── types/
│   └── geo.ts                    # Modelos de datos TypeScript (GeoPhoto, Coords, AlbumItem)
├── screenshots/                  # Capturas de ejecucion en dispositivo fisico (iPhone)
│   ├── inicio.jpg
│   ├── galeria.jpg
│   └── mapa.jpg
├── drizzle.config.ts             # Configuracion de Drizzle Kit para Expo SQLite
├── metro.config.js               # Resolucion de archivos .sql para migraciones
├── babel.config.js               # Plugin inline-import para SQL
├── AI-LOG.md                     # Auditoria de IA de la Semana 7 y Semana 8
└── README.md                     # Documentacion general del repositorio
```

---

## Semana 8 — Backend as a Service con Supabase

### Novedades Integradas
1. **Supabase Auth & Rutas Protegidas (T1, T2, T3)**:
   - Pantalla de Login / Registro (`app/login.tsx`) integrada con `@supabase/supabase-js`.
   - Persistencia segura de tokens en `expo-secure-store` dividida en chunks de 1000 caracteres (`lib/secureStorage.ts`) para compatibilidad completa con iOS sin superar límites de 2048 bytes.
   - Navegación protegida con `Stack.Protected` en Expo Router (`app/_layout.tsx`), redirigiendo a login si no hay sesión activa.
2. **Esquema SQLite Extendido con Drizzle (T4 / C5)**:
   - Migración `0002_great_scarecrow.sql` agregando `clientId`, `updatedAt`, `remotePath`, `syncedAt` y `ownerId`.
   - Aislamiento de datos por usuario (`ownerId`): las fotos locales se filtran por el ID del usuario autenticado.
3. **Storage Privado y Políticas RLS (T5 / C2 / C3)**:
   - Bucket privado `geocam` en Supabase con política de carpetas `(storage.foldername(name))[1] = auth.uid()::text`.
   - Subida y prevención de huérfanos/duplicados con rollback ante fallos en `services/cloudPhotos.ts`.
   - Borrado coherente (C3): al eliminar una foto en SQLite, se elimina automáticamente su registro remoto y el archivo en Supabase Storage.
4. **Sincronización Individual y Masiva (T5 / C1)**:
   - Detalle de Foto (`app/photo/[id].tsx`): Tarjeta de estado de sincronización y botón *"Subir a la nube"*.
   - Pantalla de Inicio (`app/(tabs)/inicio.tsx`): Contador reactivo de fotos en nube y banner de sincronización masiva pendiente.

### Configuración de Supabase
1. Copiar `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
2. Completar las variables de entorno con las credenciales de tu proyecto Supabase:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-anon-key-aqui
   ```
3. Ejecutar el script SQL en el **SQL Editor** de tu proyecto Supabase:
   - Ubicación: `supabase/schema.sql` (crea la tabla `photos`, activa RLS, crea el bucket privado `geocam` y configura las políticas de Storage para usuarios autenticados).

---

## Proyecto Independiente: Muro de Clase

El proyecto de aula **Muro de Clase** (Semana 8) se encuentra alojado y organizado de manera independiente en:
`../semana-8/muro-de-clase`
Cuenta con su propia configuración de Expo, `package.json`, esquema SQL de Supabase (`muro_posts` y bucket público `muro_fotos`), suscripciones Realtime y autenticación Supabase completa.

---

## Verificacion de Criterios de Entrega

- [x] **Migraciones versionadas**: Se generaron tres migraciones (`0000`, `0001` y `0002`) con `drizzle-kit generate` sin edicion manual.
- [x] **Preservacion de datos locales**: Columnas agregadas con `ALTER TABLE ADD COLUMN` preservando las fotos locales previas.
- [x] **Autenticacion Supabase**: Login/Registro con `expo-secure-store` y control de sesiones con auto-refresh.
- [x] **Almacenamiento Privado Seguro**: Bucket `geocam` con RLS restringido a la carpeta de cada usuario.
- [x] **Borrado coherente (C3)**: Eliminación simultánea en SQLite, tabla Postgres y Supabase Storage.
- [x] **Compilacion TypeScript**: 0 errores de compilacion con `npx tsc --noEmit`.
- [x] **Export Metro Bundler**: Compilación exitosa para producción (1489 módulos empaquetados).
