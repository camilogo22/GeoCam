# 📸 GeoCam — Módulos Nativos y Sensores del Dispositivo

Aplicación móvil desarrollada con **Expo**, **React Native** y **TypeScript** para el Taller Integrador de la Semana 6.

**Desarrollador:** Camilo Gomez  
**Semana:** 6 — Módulos Nativos y Sensores del Dispositivo  

---

## 🚀 Características Principales

- **Cámara Nativa (`expo-camera`)**: Vista previa fluida con `CameraView`, alternancia de cámara frontal/trasera y protección contra dobles toques simultáneos.
- **Geolocalización Reactiva (`expo-location`)**: Máquina de estados completa de permisos (`checking`, `undetermined`, `granted`, `denied`, `blocked`), lectura puntual bajo demanda y seguimiento continuo con coordenadas en vivo.
- **Degradación Elegante**: Si el usuario rechaza la ubicación, la cámara sigue funcionando normalmente y las fotos se almacenan con `coords: null`.
- **Selector de Galería (`expo-image-picker`)**: Importación de fotos de la galería distinguidas visualmente con insignias (`📷` vs `🖼️`).
- **Sensor de Movimiento (`expo-sensors`)**: Detección de agitación del teléfono (*shake*) mediante el acelerómetro con umbral de fuerza, frecuencia de 100 ms y tiempo de enfriamiento (*cooldown*) para confirmar el borrado masivo de fotos.
- **Mapa Interactivo (`react-native-maps`)**: Marcadores interactivos para fotos geolocalizadas con *Callouts* que muestran la miniatura, y panel inferior horizontal para fotos *"Sin ubicación"*.
- **Estado Global Inmutable (`GeoPhotosContext`)**: Manejo centralizado y seguro de la colección de fotos en memoria.

---

## 📂 Estructura del Proyecto

```text
semana-6/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Configura las 2 pestañas y envuelve en GeoPhotosProvider
│   │   ├── geocam.tsx            # Pestaña 1: Cámara, coordenadas en vivo y disparo
│   │   └── mapa.tsx              # Pestaña 2: Mapa interactivo y fotos sin ubicación
│   ├── _layout.tsx               # Root Layout con Stack y StatusBar
│   └── index.tsx                 # Redirección a /(tabs)/geocam
├── components/
│   └── PermissionPrimer.tsx      # Explicación en contexto y botón "Abrir Ajustes"
├── context/
│   └── GeoPhotosContext.tsx      # Contexto inmutable para almacenar fotos
├── hooks/
│   ├── useCamera.ts              # Hook nativo para CameraView y permisos
│   ├── useGeoLocation.ts         # Hook nativo para GPS y seguimiento
│   └── useShake.ts               # Hook con acelerómetro y umbral de agitación
├── types/
│   └── geo.ts                    # Modelos de datos TypeScript (Coords, GeoPhoto, PermissionState)
├── app.json                      # Configuración de Expo y plugins nativos
├── AI-LOG.md                     # Registro de auditoría de IA y detección de alucinaciones
├── GUIA_DESARROLLO_GEOCAM.md     # Guía detallada del proyecto
└── README.md                     # Documentación general y evidencia de pruebas
```

---

## 🛡️ Máquina de Estados de Permisos

GeoCam implementa la máquina de estados de permisos requerida:

```text
checking ──> undetermined ──> (acepta)  ──> granted
                          ──> (rechaza) ──> denied ──> (rechaza de nuevo) ──> blocked
blocked  ──> Linking.openSettings() ──> (habilita en Ajustes) ──> granted
```

### Evidencia de los 3 Estados de Permisos

| 1. Permiso Concedido (`granted`) | 2. Permiso Rechazado (`denied`) | 3. Permiso Bloqueado (`blocked`) |
| :---: | :---: | :---: |
| *Cámara activa con coordenadas GPS en vivo (ej. `4.60971, -74.08175 ±12m`)* | *Cámara activa sin GPS. Muestra banner superior: "⚠️ Activa la ubicación para etiquetar tus fotos"* | *Pantalla PermissionPrimer con botón directo: **"Abrir Ajustes"*** |
| *(Inserta aquí captura de pantalla 1)* | *(Inserta aquí captura de pantalla 2)* | *(Inserta aquí captura de pantalla 3)* |

---

## 📲 Instrucciones de Ejecución

1. Clona el repositorio e instala las dependencias:
   ```bash
   npm install
   ```

2. Inicia el servidor de desarrollo de Expo con soporte para túnel (ideal para probar en dispositivo físico):
   ```bash
   npx expo start --tunnel
   ```

3. Abre la aplicación **Expo Go** en tu teléfono físico (Android o iOS) y escanea el código QR mostrado en la terminal.

---

## 🧪 Pruebas Realizadas

- [x] **Permisos en contexto**: La aplicación no solicita permisos al arrancar; se consultan de fondo y se solicita interacción solo cuando se necesita.
- [x] **Degradación elegante**: Al negar la ubicación, las fotos se guardan y se listan correctamente en la sección *"Sin ubicación"* del mapa.
- [x] **Redirección a Ajustes**: Tras dos rechazos en Android, el botón cambia automáticamente a *"Abrir Ajustes"*, llevando al panel de la app en el SO.
- [x] **Limpieza de recursos**: Todas las suscripciones a sensores (`Accelerometer`) y GPS (`watchPositionAsync`) liberan sus hilos nativos mediante `.remove()` y la bandera `cancelled`.
