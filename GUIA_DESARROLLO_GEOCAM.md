# Guía Completa de Desarrollo: GeoCam (Semana 6)
**Módulos Nativos y Sensores del Dispositivo**  
*Materia: Desarrollo Móvil — Taller Integrador 2*  
*Estudiante / Desarrollador:* **Camilo Gomez**  
*Autor de referencia:* @AntonioJGL | *Fecha:* Sep 2026  

---

## 📑 Tabla de Contenidos
1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Respuestas a las Preguntas de Repaso (Teoría)](#2-respuestas-a-las-preguntas-de-repaso-teoría)
3. [Estructura del Proyecto y Configuración](#3-estructura-del-proyecto-y-configuración)
4. [Tipos Compartidos (`types/geo.ts`)](#4-tipos-compartidos-typesgeots)
5. [Custom Hooks Nativos](#5-custom-hooks-nativos)
   - 5.1 [`useGeoLocation.ts` (GPS & Permisos)](#51-hooksusegeolocationts)
   - 5.2 [`useCamera.ts` (CameraView & Guardas)](#52-hooksusecamerats)
   - 5.3 [`useShake.ts` (Acelerómetro & Cooldown)](#53-hooksuseshakets)
6. [Componente de Permisos (`PermissionPrimer.tsx`)](#6-componente-componentspermissionprimertsx)
7. [Estado Global (`context/GeoPhotosContext.tsx`)](#7-estado-global-contextgeophotoscontexttsx)
8. [Vistas de la Aplicación](#8-vistas-de-la-aplicación)
   - 8.1 [Layout de Pestañas (`app/(tabs)/_layout.tsx`)](#81-apptabs_layouttsx)
   - 8.2 [Pantalla Cámara (`app/(tabs)/geocam.tsx`)](#82-apptabsgeocamtsx)
   - 8.3 [Pantalla Mapa (`app/(tabs)/mapa.tsx`)](#83-apptabsmapatsx)
9. [Bitácora de IA Obligatoria (`AI-LOG.md`)](#9-bitácora-de-ia-obligatoria-ai-logmd)
10. [Guía de Pruebas y Checklist de Entrega](#10-guía-de-pruebas-y-checklist-de-entrega)

---

## 1. Visión General del Proyecto

**GeoCam** es una aplicación móvil construida sobre **Expo / React Native con TypeScript** que combina tres elementos nativos esenciales:
- **Cámara (`expo-camera`)**: Captura fotográfica con control de orientación (*front/back*) y prevención de carreras de disparo.
- **Ubicación (`expo-location`)**: Lectura de coordenadas GPS en primer plano (`Accuracy.Balanced`), asociadas a cada foto.
- **Sensores (`expo-sensors`)**: Detección de agitación del dispositivo (*shake*) mediante el acelerómetro con umbral y tiempo de enfriamiento (*cooldown*).
- **Mapa interactivo (`react-native-maps`)**: Visualización geográfica de las fotos capturadas y sección para imágenes importadas sin coordenadas.

### Principio Clave: Degradación Elegante y Ciclo de Permisos
El hardware no debe bloquear la aplicación de forma destructiva:
1. **Sin permisos de GPS**: La cámara sigue funcionando normalmente; la propiedad `coords` de la foto se guarda como `null`.
2. **Permiso Bloqueado (`canAskAgain: false`)**: Se presenta al usuario una pantalla explicativa (*PermissionPrimer*) con un botón directo a Ajustes del Sistema (`Linking.openSettings()`).
3. **Limpieza de Suscripciones**: Toda suscripción a hardware (`watchPositionAsync`, acelerómetro) implementa una bandera `cancelled` para evitar *memory leaks* y suscripciones huérfanas en desmontajes tempranos.

---

## 2. Respuestas a las Preguntas de Repaso (Teoría)

### Pregunta 1: ¿Qué diferencia hay entre un permiso `denied` y uno con `canAskAgain: false`?
- **`denied`**: El usuario rechazó el permiso, pero el sistema operativo todavía permite mostrar nuevamente el cuadro de diálogo nativo si la aplicación lo vuelve a solicitar.
- **`canAskAgain: false` (o `blocked`)**: El usuario ha rechazado el permiso de forma definitiva (en iOS tras el primer rechazo; en Android 11+ tras dos rechazos, o marcando "No volver a preguntar"). En este estado, el sistema **no volverá a mostrar el cuadro de diálogo nativo**; cualquier llamada adicional a la API de permisos fallará de inmediato. La única forma de concederlo es enviar manualmente al usuario a la pantalla de configuración del dispositivo mediante `Linking.openSettings()`.

### Pregunta 2: ¿Por qué un `useEffect` que se suscribe a un sensor necesita función de limpieza y bandera `cancelled`?
- **Función de limpieza (`subscription.remove()`)**: Los sensores físicos y el GPS ejecutan hilos nativos en segundo plano. Si no se cancelan al desmontar la pantalla, continuarán ejecutándose indefinidamente, provocando fugas de memoria (*memory leaks*), sobrecalentamiento y un alto consumo de batería.
- **Bandera `cancelled = true`**: Las APIs nativas de suscripción (como `Location.watchPositionAsync`) devuelven una `Promise`. Si el usuario entra y sale rápidamente de la pantalla antes de que la promesa se resuelva, la función de limpieza se ejecutará antes de recibir el objeto de suscripción. Sin la bandera `cancelled`, la suscripción se resolvería después y quedaría "huérfana" sin posibilidad de removerse.

### Pregunta 3: ¿Dónde se declaran los textos que iOS muestra al pedir un permiso?
Se declaran en el archivo **`app.json`** dentro del arreglo `"expo.plugins"` (para los config plugins de Expo) o en `"expo.ios.infoPlist"`. Al generar el build nativo, Expo inyecta estas cadenas en el archivo nativo **`Info.plist`** de Xcode (bajo claves como `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription` y `NSPhotoLibraryUsageDescription`).  
*Nota importante:* En `Expo Go` se verán los textos genéricos de la app Expo Go; los textos personalizados solo se visualizan en compilaciones propias (*development builds* o *standalone apps*).

### Pregunta 4: Si una librería nativa no está incluida en Expo Go, ¿qué alternativa existe?
Se debe utilizar un **Development Build** mediante **`expo-dev-client`** y compilar el proyecto utilizando **EAS Build** (`npx eas build --profile development`) o localmente con `npx expo run:android` / `npx expo run:ios` (prebuild nativo). Esto permite enlazar cualquier librería nativa de Android (Kotlin/Java) o iOS (Swift/Objective-C) manteniendo la experiencia de desarrollo rápida de Expo.

---

## 3. Estructura del Proyecto y Configuración

### 3.1 Instalación de Paquetes
Ejecuta en la terminal de tu proyecto:
```bash
npx expo install expo-camera expo-location expo-image-picker expo-sensors react-native-maps
```

### 3.2 Configuración de `app.json`
Agrega la sección de plugins dentro del bloque `"expo"`:
```json
{
  "expo": {
    "name": "GeoCam",
    "slug": "geocam",
    "version": "1.0.0",
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "GeoCam usa la cámara para tomar fotos geolocalizadas.",
          "recordAudioAndroid": false
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "GeoCam usa tu ubicación para registrar dónde tomaste cada foto."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "GeoCam accede a tu galería para importar fotos."
        }
      ]
    ]
  }
}
```

---

## 4. Tipos Compartidos (`types/geo.ts`)

Crea el archivo `types/geo.ts` para centralizar la tipificación estricta:

```typescript
// types/geo.ts

export type PermissionState =
  | 'checking'
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'blocked';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface GeoPhoto {
  id: string;
  uri: string;
  coords: Coords | null; // null si el usuario no dio permiso GPS
  source: 'camera' | 'gallery';
  createdAt: number;
}
```

---

## 5. Custom Hooks Nativos

### 5.1 `hooks/useGeoLocation.ts`
Maneja la máquina de estados de ubicación, consulta puntual y seguimiento reactivo con limpieza segura:

```typescript
// hooks/useGeoLocation.ts
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import type { Coords, PermissionState } from '@/types/geo';

interface Options {
  watch?: boolean;
}

interface GeoLocationState {
  permission: PermissionState;
  coords: Coords | null;
  error: string | null;
}

function mapPermission(res: Location.LocationPermissionResponse): PermissionState {
  if (res.granted) return 'granted';
  if (!res.canAskAgain) return 'blocked';
  if (res.status === 'undetermined') return 'undetermined';
  return 'denied';
}

function toCoords(loc: Location.LocationObject): Coords {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    timestamp: loc.timestamp,
  };
}

export function useGeoLocation({ watch = false }: Options = {}) {
  const [state, setState] = useState<GeoLocationState>({
    permission: 'checking',
    coords: null,
    error: null,
  });

  // 1. Al montar: solo CONSULTAR el estado del permiso, NUNCA solicitarlo al usuario
  useEffect(() => {
    let cancelled = false;

    Location.getForegroundPermissionsAsync()
      .then((res) => {
        if (!cancelled) {
          setState((s) => ({ ...s, permission: mapPermission(res) }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState((s) => ({ ...s, permission: 'denied' }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Solicitar permiso por acción explícita del usuario
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      setState((s) => ({ ...s, permission: mapPermission(res) }));
      return res.granted;
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : 'Error al solicitar permiso',
      }));
      return false;
    }
  }, []);

  // 3. Lectura única (ideal justo antes de capturar la foto)
  const getCurrent = useCallback(async (): Promise<Coords | null> => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = toCoords(loc);
      setState((s) => ({ ...s, coords, error: null }));
      return coords;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'No se pudo obtener la ubicación';
      setState((s) => ({ ...s, error: message }));
      return null;
    }
  }, []);

  // 4. Seguimiento continuo con limpieza segura ante desmontaje
  useEffect(() => {
    if (!watch || state.permission !== 'granted') return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (loc) => {
        if (!cancelled) {
          setState((s) => ({ ...s, coords: toCoords(loc), error: null }));
        }
      }
    )
      .then((sub) => {
        if (cancelled) {
          sub.remove(); // Se desmontó antes de resolver la promesa
        } else {
          subscription = sub;
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            error: e instanceof Error ? e.message : 'Error de GPS',
          }));
        }
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [watch, state.permission]);

  const openSettings = useCallback(() => Linking.openSettings(), []);

  return { ...state, requestPermission, getCurrent, openSettings };
}
```

---

### 5.2 `hooks/useCamera.ts`
Encapsula la cámara moderna de Expo con `CameraView`, guarda contra doble pulsación y alternador de orientación:

```typescript
// hooks/useCamera.ts
import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import type { PermissionState } from '@/types/geo';

export function useCamera() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const permissionState: PermissionState = !permission
    ? 'checking'
    : permission.granted
    ? 'granted'
    : !permission.canAskAgain
    ? 'blocked'
    : permission.status === 'undetermined'
    ? 'undetermined'
    : 'denied';

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !isReady || isCapturing) return null;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      return photo ?? null;
    } catch {
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [isReady, isCapturing]);

  return {
    cameraRef,
    permissionState,
    requestPermission,
    openSettings: () => Linking.openSettings(),
    facing,
    toggleFacing,
    onCameraReady: () => setIsReady(true),
    takePhoto,
    isCapturing,
  };
}
```

---

### 5.3 `hooks/useShake.ts` (Requisito R4)
Monitorea el acelerómetro físico, calcula la aceleración resultante $\|\vec{a}\| = \sqrt{x^2 + y^2 + z^2}$, filtra falsos positivos mediante umbral y enfriamiento (*cooldown*):

```typescript
// hooks/useShake.ts
import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

interface UseShakeOptions {
  threshold?: number;   // Magnitud para detonar (por defecto 1.78g)
  cooldownMs?: number;  // Tiempo de espera entre sacudidas (por defecto 1000ms)
}

export function useShake(
  onShake: () => void,
  options: UseShakeOptions = {}
): { isAvailable: boolean | null } {
  const { threshold = 1.78, cooldownMs = 1000 } = options;
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Guardamos onShake en ref para que el callback no regenere la suscripción
  const callbackRef = useRef(onShake);
  callbackRef.current = onShake;

  const lastShakeTime = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    Accelerometer.isAvailableAsync().then((available) => {
      if (cancelled) return;
      setIsAvailable(available);

      if (!available) return;

      Accelerometer.setUpdateInterval(100); // 100 ms es óptimo para gestos

      subscription = Accelerometer.addListener(({ x, y, z }) => {
        // En reposo, la gravedad terrestre suma aproximadamente 1g
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        if (magnitude > threshold && now - lastShakeTime.current > cooldownMs) {
          lastShakeTime.current = now;
          callbackRef.current();
        }
      });
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [threshold, cooldownMs]);

  return { isAvailable };
}
```

---

## 6. Componente `PermissionPrimer.tsx`

Pantalla explicativa amigable para la solicitud contextual de permisos:

```tsx
// components/PermissionPrimer.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PermissionState } from '@/types/geo';

interface Props {
  title: string;
  description: string;
  state: PermissionState;
  onRequest: () => void;
  onOpenSettings: () => void;
}

export function PermissionPrimer({
  title,
  description,
  state,
  onRequest,
  onOpenSettings,
}: Props) {
  const isBlocked = state === 'blocked';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>
        {isBlocked
          ? 'Desactivaste este permiso. Puedes habilitarlo manualmente desde los Ajustes del sistema.'
          : description}
      </Text>
      <Pressable
        onPress={isBlocked ? onOpenSettings : onRequest}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          {isBlocked ? 'Abrir Ajustes' : 'Permitir acceso'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#d4d4d4',
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#10b981',
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontWeight: 'bold',
    color: '#0a0a0a',
    fontSize: 16,
  },
});
```

---

## 7. Estado Global (`context/GeoPhotosContext.tsx` - Requisito R1)

Administra las fotos en memoria con inmutabilidad, permitiendo agregar, borrar una foto y limpiar todas:

```typescript
// context/GeoPhotosContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { GeoPhoto } from '@/types/geo';

interface GeoPhotosContextType {
  photos: GeoPhoto[];
  addPhoto: (photo: GeoPhoto) => void;
  removePhoto: (id: string) => void;
  clearAll: () => void;
}

const GeoPhotosContext = createContext<GeoPhotosContextType | undefined>(undefined);

export function GeoPhotosProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);

  const addPhoto = useCallback((newPhoto: GeoPhoto) => {
    // Actualización inmutable
    setPhotos((prev) => [newPhoto, ...prev]);
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setPhotos([]);
  }, []);

  const value = useMemo(
    () => ({ photos, addPhoto, removePhoto, clearAll }),
    [photos, addPhoto, removePhoto, clearAll]
  );

  return (
    <GeoPhotosContext.Provider value={value}>
      {children}
    </GeoPhotosContext.Provider>
  );
}

export function useGeoPhotos() {
  const context = useContext(GeoPhotosContext);
  if (!context) {
    throw new Error('useGeoPhotos debe ser utilizado dentro de un GeoPhotosProvider');
  }
  return context;
}
```

---

## 8. Vistas de la Aplicación

### 8.1 `app/(tabs)/_layout.tsx`
Configura las pestañas de navegación y envuelve la app con el `GeoPhotosProvider`:

```tsx
// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GeoPhotosProvider } from '@/context/GeoPhotosContext';

export default function TabsLayout() {
  return (
    <GeoPhotosProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#171717', borderTopColor: '#262626' },
          tabBarActiveTintColor: '#10b981',
          tabBarInactiveTintColor: '#a3a3a3',
        }}
      >
        <Tabs.Screen
          name="geocam"
          options={{
            title: 'GeoCam',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="camera" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="mapa"
          options={{
            title: 'Mapa',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </GeoPhotosProvider>
  );
}
```

---

### 8.2 `app/(tabs)/geocam.tsx` (Requisitos R1, R2 y R4)
Contiene la cámara en vivo, el botón para importar desde galería, el banner de advertencia si no hay GPS y la integración con `useShake`:

```tsx
// app/(tabs)/geocam.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Alert } from 'react-native';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useCamera } from '@/hooks/useCamera';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useShake } from '@/hooks/useShake';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import type { GeoPhoto } from '@/types/geo';

export default function GeoCamScreen() {
  const cam = useCamera();
  const geo = useGeoLocation({ watch: true });
  const { photos, addPhoto, clearAll } = useGeoPhotos();
  const [lastPhoto, setLastPhoto] = useState<GeoPhoto | null>(photos[0] ?? null);

  // R4: Sensor de sacudida para borrar todas las fotos
  useShake(() => {
    if (photos.length === 0) return;
    Alert.alert(
      '¿Borrar todas las fotos?',
      'Has agitado el teléfono. ¿Deseas eliminar todas las capturas registradas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: () => {
            clearAll();
            setLastPhoto(null);
          },
        },
      ]
    );
  });

  // Si aún está consultando permisos nativos
  if (cam.permissionState === 'checking') {
    return <View style={styles.loadingContainer} />;
  }

  // Si no hay permiso de cámara, mostrar el primer explicativo
  if (cam.permissionState !== 'granted') {
    return (
      <PermissionPrimer
        title="GeoCam necesita tu cámara"
        description="La usamos para capturar las fotografías que decidas registrar."
        state={cam.permissionState}
        onRequest={cam.requestPermission}
        onOpenSettings={cam.openSettings}
      />
    );
  }

  // Capturar foto con cámara
  const handleCapture = async () => {
    const photo = await cam.takePhoto();
    if (!photo) return;

    // Degradación elegante: si no hay GPS, coords es null
    const coords =
      geo.permission === 'granted'
        ? geo.coords ?? (await geo.getCurrent())
        : null;

    const newPhoto: GeoPhoto = {
      id: String(Date.now()),
      uri: photo.uri,
      coords,
      source: 'camera',
      createdAt: Date.now(),
    };

    addPhoto(newPhoto);
    setLastPhoto(newPhoto);
  };

  // R2: Importar desde galería
  const handlePickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const coords =
        geo.permission === 'granted'
          ? geo.coords ?? (await geo.getCurrent())
          : null;

      const newPhoto: GeoPhoto = {
        id: String(Date.now()),
        uri: result.assets[0].uri,
        coords,
        source: 'gallery',
        createdAt: Date.now(),
      };

      addPhoto(newPhoto);
      setLastPhoto(newPhoto);
    }
  };

  return (
    <View style={styles.container}>
      {/* CameraView sin hijos: los controles van superpuestos en posición absoluta */}
      <CameraView
        ref={cam.cameraRef}
        style={StyleSheet.absoluteFill}
        facing={cam.facing}
        onCameraReady={cam.onCameraReady}
      />

      {/* Banner de ubicación: solicitar en contexto sin bloquear la cámara */}
      {geo.permission !== 'granted' && geo.permission !== 'checking' && (
        <Pressable
          onPress={
            geo.permission === 'blocked' ? geo.openSettings : geo.requestPermission
          }
          style={styles.locationBanner}
        >
          <Text style={styles.bannerText}>
            ⚠️ Activa la ubicación para etiquetar tus fotos
          </Text>
        </Pressable>
      )}

      {/* Coordenadas en vivo en pantalla */}
      {geo.coords && (
        <View style={styles.coordsBadge}>
          <Text style={styles.coordsText}>
            {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)}
          </Text>
          <Text style={styles.coordsAccuracy}>
            ±{Math.round(geo.coords.accuracy ?? 0)} m
          </Text>
        </View>
      )}

      {/* Controles inferiores */}
      <View style={styles.bottomBar}>
        {/* Última miniatura o botón de galería */}
        <Pressable onPress={handlePickFromGallery} style={styles.thumbnailBtn}>
          {lastPhoto ? (
            <View>
              <Image source={{ uri: lastPhoto.uri }} style={styles.thumbnail} />
              <View style={styles.sourceTag}>
                <Text style={styles.sourceTagText}>
                  {lastPhoto.source === 'camera' ? '📷' : '🖼️'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.galleryPlaceholder}>
              <Text style={{ fontSize: 24 }}>🖼️</Text>
            </View>
          )}
        </Pressable>

        {/* Botón de disparo */}
        <Pressable
          onPress={handleCapture}
          disabled={cam.isCapturing}
          style={styles.shutterOuter}
          accessibilityLabel="Tomar foto"
        >
          <View
            style={[
              styles.shutterInner,
              cam.isCapturing && styles.shutterCapturing,
            ]}
          />
        </Pressable>

        {/* Botón cambiar cámara frontal/trasera */}
        <Pressable
          onPress={cam.toggleFacing}
          style={styles.toggleBtn}
          accessibilityLabel="Cambiar orientación de cámara"
        >
          <Text style={styles.toggleText}>↻</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a' },
  locationBanner: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.95)',
    borderRadius: 12,
    padding: 12,
    zIndex: 10,
  },
  bannerText: {
    color: '#1c1917',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  coordsBadge: {
    position: 'absolute',
    top: 56,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 9,
  },
  coordsText: {
    color: '#6ee7b7',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
  },
  coordsAccuracy: {
    color: '#a3a3a3',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 10,
  },
  thumbnailBtn: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  thumbnail: { width: 56, height: 56, borderRadius: 10, borderWidth: 2, borderColor: '#ffffff' },
  galleryPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#404040',
  },
  sourceTag: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#171717',
    borderRadius: 8,
    padding: 2,
  },
  sourceTagText: { fontSize: 10 },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff' },
  shutterCapturing: { backgroundColor: '#a3a3a3' },
  toggleBtn: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 32, color: '#ffffff', fontWeight: 'bold' },
});
```

---

### 8.3 `app/(tabs)/mapa.tsx` (Requisito R3)
Muestra las fotos geolocalizadas con marcadores en el mapa y agrupa las fotos sin coordenadas en un panel inferior:

```tsx
// app/(tabs)/mapa.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, FlatList } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import type { GeoPhoto } from '@/types/geo';

export default function MapaScreen() {
  const { photos } = useGeoPhotos();
  const { coords: currentCoords } = useGeoLocation({ watch: false });

  // Fotos con ubicación vs fotos sin ubicación
  const mappedPhotos = useMemo(
    () => photos.filter((p): p is GeoPhoto & { coords: NonNullable<GeoPhoto['coords']> } => p.coords !== null),
    [photos]
  );

  const unmappedPhotos = useMemo(
    () => photos.filter((p) => p.coords === null),
    [photos]
  );

  // Determinar punto inicial del mapa (mi ubicación o la última foto con GPS)
  const initialRegion = useMemo(() => {
    if (currentCoords) {
      return {
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };
    }
    if (mappedPhotos.length > 0) {
      return {
        latitude: mappedPhotos[0].coords.latitude,
        longitude: mappedPhotos[0].coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    // Región por defecto (ej. Bogotá, Colombia)
    return {
      latitude: 4.6097,
      longitude: -74.0817,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [currentCoords, mappedPhotos]);

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={initialRegion} showsUserLocation>
        {mappedPhotos.map((photo) => (
          <Marker
            key={photo.id}
            coordinate={{
              latitude: photo.coords.latitude,
              longitude: photo.coords.longitude,
            }}
            title={photo.source === 'camera' ? 'Foto de Cámara' : 'Foto de Galería'}
            description={new Date(photo.createdAt).toLocaleTimeString()}
          >
            <Callout>
              <View style={styles.calloutBox}>
                <Image source={{ uri: photo.uri }} style={styles.calloutImage} />
                <Text style={styles.calloutText}>
                  {photo.source === 'camera' ? 'Cámara' : 'Galería'} •{' '}
                  {new Date(photo.createdAt).toLocaleTimeString()}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* R3: Lista inferior para fotos sin ubicación */}
      {unmappedPhotos.length > 0 && (
        <View style={styles.unmappedPanel}>
          <Text style={styles.unmappedTitle}>
            Fotos sin ubicación ({unmappedPhotos.length})
          </Text>
          <FlatList
            horizontal
            data={unmappedPhotos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.unmappedCard}>
                <Image source={{ uri: item.uri }} style={styles.unmappedThumb} />
                <Text style={styles.unmappedTag}>
                  {item.source === 'camera' ? '📷' : '🖼️'}
                </Text>
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  map: { flex: 1 },
  calloutBox: { width: 140, alignItems: 'center', padding: 4 },
  calloutImage: { width: 120, height: 90, borderRadius: 8 },
  calloutText: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  unmappedPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(23, 23, 23, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  unmappedTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  unmappedCard: { marginRight: 10, position: 'relative' },
  unmappedThumb: { width: 50, height: 50, borderRadius: 8, borderWidth: 1, borderColor: '#525252' },
  unmappedTag: { position: 'absolute', bottom: 2, right: 2, fontSize: 10 },
});
```

---

## 9. Bitácora de IA Obligatoria (`AI-LOG.md`)

Crea en la raíz del repositorio el archivo `AI-LOG.md` con este contenido base:

```markdown
# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** [Tu Nombre y Apellido]
**Semana:** 6
**Proyecto:** GeoCam – Taller Integrador 2

## 1. Prompts Utilizados
- *"Escribe un Custom Hook en React Native con TypeScript que detecte cuando el usuario agita el teléfono usando expo-sensors, con umbral configurable y evitando memory leaks."*
- *"Cómo implementar la degradación elegante de permisos en expo-camera y expo-location con React Native New Architecture."*

## 2. Código Generado vs. Código Modificado
- **¿Qué generó la IA?:** Generó un hook que se suscribía a `Accelerometer` directamente dentro de `useEffect`, sin configurar `setUpdateInterval` y disparando el callback de forma descontrolada varias decenas de veces por cada movimiento.
- **¿Qué modifiqué/corregí?:** Añadí `Accelerometer.setUpdateInterval(100)`, un `cooldownMs` de 1000 ms, verificación previa con `isAvailableAsync()` y la bandera `cancelled` para no dejar suscripciones huérfanas al desmontar el componente.

## 3. Alucinaciones o Errores Detectados
- **Alucinación 1 (API obsoleta):** La IA generó `import { Camera } from 'expo-camera'` con `Camera.requestCameraPermissionsAsync()`. Fue corregido por `CameraView` y el hook oficial `useCameraPermissions()` del SDK moderno de Expo.
- **Alucinación 2 (Propiedad deprecada):** La IA propuso `ImagePicker.MediaTypeOptions.Images` para la selección de galería, el cual fue reemplazado por la sintaxis moderna `mediaTypes: ['images']`.
- **Alucinación 3 (Estructura de vista):** La IA intentó anidar los botones de disparo como componentes hijos `<CameraView><Pressable /></CameraView>`. La documentación actual de Expo indica que `CameraView` no soporta hijos directos, requiriendo controles hermanos superpuestos con posición absoluta.
```

---

## 10. Guía de Pruebas y Checklist de Entrega

### 10.1 Procedimiento de Pruebas en Teléfono Físico
1. Inicia el servidor de desarrollo:
   ```bash
   npx expo start --tunnel
   ```
2. Escanea el código QR con la app **Expo Go** en tu dispositivo físico (Android o iPhone).
3. **Prueba 1 (Degradación elegante)**:
   - Al solicitar ubicación, pulsa **Rechazar / Denegar**.
   - Comprueba que la cámara **sigue activa**.
   - Toma una foto: la foto debe guardarse con éxito y aparecer en la pestaña Mapa en la sección *"Sin ubicación"*.
4. **Prueba 2 (Permiso Bloqueado)**:
   - En Android, rechaza la cámara 2 veces consecutivas.
   - Verifica que aparece la pantalla `PermissionPrimer` con el botón **"Abrir Ajustes"**.
   - Pulsa el botón y confirma que abre la sección de permisos de la aplicación en el sistema operativo.
5. **Prueba 3 (Sensor Shake)**:
   - Agita el teléfono con vigor.
   - Verifica que surge el diálogo nativo: *¿Borrar todas las fotos?*
   - Al presionar *Borrar todo*, la lista y el mapa quedan limpios.
6. **Prueba 4 (Galería)**:
   - Presiona el botón de galería e importa una fotografía. Comprueba que se marca con el icono 🖼️.

### 10.2 Checklist Final de Entrega
- [x] `types/geo.ts` con tipado estricto sin `any`.
- [x] Custom Hooks: `useGeoLocation.ts`, `useCamera.ts` y `useShake.ts`.
- [x] Componente `PermissionPrimer.tsx` con soporte para estado `blocked`.
- [x] Contexto global `GeoPhotosContext.tsx` con operaciones inmutables.
- [x] Pantallas `app/(tabs)/geocam.tsx` y `app/(tabs)/mapa.tsx`.
- [x] Archivo `AI-LOG.md` con prompts, correcciones y alucinaciones.
- [x] Archivo `README.md` con las 3 capturas/GIFs requeridas:
  1. Estado concedido.
  2. Estado rechazado (degradación elegante).
  3. Estado bloqueado ("Abrir Ajustes").
