# Registro de Auditoría de Inteligencia Artificial (AI-LOG)

> **Materia:** Desarrollo Móvil — Taller Integrador 2  
> **Semana:** 6 — Módulos Nativos y Sensores del Dispositivo  
> **Proyecto:** GeoCam  
> **Estudiante:** **Camilo Gomez**  
> **Docente de referencia:** @AntonioJGL  
> **Ecosistema:** Expo SDK 57 | React Native 0.86 (New Architecture) | TypeScript

---

> [!NOTE]
> Este documento registra de manera formal la auditoría técnica realizada sobre el código asistido por IA durante el desarrollo del proyecto **GeoCam**. Su objetivo es identificar alucinaciones, APIs obsoletas y malas prácticas en el acceso a hardware nativo, documentando las correcciones implementadas según los estándares modernos de Expo.

---

## 1. Prompts Utilizados y Objetivos Técnicos

| # | Prompt Ejecutado | Objetivo Técnico | Resultado Obtenido |
| :---: | :--- | :--- | :--- |
| **P1** | *"Escribe un Custom Hook en React Native con TypeScript que detecte cuando el usuario agita el teléfono usando expo-sensors, con umbral configurable y prevención de fugas de memoria."* | Encapsular el acelerómetro con frecuencia controlada, cálculo vectorial y limpieza de suscripción. | Generó un hook funcional pero con errores críticos de frecuencia de muestreo y sin protección contra suscripciones huérfanas. |
| **P2** | *"Implementa un hook useCamera con la nueva API de Expo Camera (CameraView) que evite colapsos por doble pulsación y permita alternar entre cámara frontal y trasera."* | Manejar el ciclo de cámara nativa con estados de preparación (`onCameraReady`) y guarda de concurrencia. | Propuso la sintaxis moderna pero intentó anidar controles hijos dentro del componente `<CameraView>`. |
| **P3** | *"Crea un hook useGeoLocation con máquina de estados de permisos completa (checking, undetermined, granted, denied, blocked) y degradación elegante si el usuario rechaza el GPS."* | Implementar el flujo UX recomendado por Apple y Google: consulta pasiva inicial y solicitud explícita bajo demanda. | Propuso solicitar permisos de inmediato en el montaje del componente, violando las pautas de UX móvil. |

---

## 2. Análisis Comparativo: Código Generado vs. Código Modificado

### 2.1 Sensor de Agitado (`hooks/useShake.ts`)

> [!WARNING]
> **Deficiencia de la IA:** La IA omitió configurar el intervalo de actualización del sensor (`setUpdateInterval`), lo que provoca que el acelerómetro opere a máxima frecuencia (hasta 200 Hz en Android), drenando la batería en minutos. Además, no implementó tiempo de enfriamiento (cooldown), disparando el callback decenas de veces con un solo movimiento físico.

#### Comparativa de Código (Diff Técnico):

```diff
- // Código generado inicialmente por la IA
- useEffect(() => {
-   const subscription = Accelerometer.addListener(({ x, y, z }) => {
-     const total = Math.sqrt(x * x + y * y + z * z);
-     if (total > 1.78) {
-       onShake(); // Se dispara 20-30 veces por cada sacudida
-     }
-   });
-   return () => subscription.remove();
- }, [onShake]); // Recrea el listener nativo en cada re-render

+ // Código refactorizado y corregido
+ const callbackRef = useRef(onShake);
+ callbackRef.current = onShake;
+ const lastShakeTime = useRef<number>(0);
+
+ useEffect(() => {
+   if (Platform.OS === 'web') { setIsAvailable(false); return; }
+   let cancelled = false;
+   let subscription: { remove: () => void } | null = null;
+
+   Accelerometer.isAvailableAsync().then((available) => {
+     if (cancelled || !available) return;
+     Accelerometer.setUpdateInterval(100); // 100 ms: balance óptimo batería/gesto
+
+     subscription = Accelerometer.addListener(({ x, y, z }) => {
+       const magnitude = Math.sqrt(x * x + y * y + z * z);
+       const now = Date.now();
+       // Filtro con cooldown de 1000 ms para evento único
+       if (magnitude > threshold && now - lastShakeTime.current > cooldownMs) {
+         lastShakeTime.current = now;
+         callbackRef.current();
+       }
+     });
+   });
+   return () => {
+     cancelled = true;
+     subscription?.remove();
+   };
+ }, [threshold, cooldownMs]);
```

---

### 2.2 Ciclo de Permisos y Degradación de GPS (`hooks/useGeoLocation.ts`)

> [!IMPORTANT]
> **Regla de UX de Autorización:** Nunca se deben pedir permisos en el evento de montaje de la pantalla. En iOS, si el usuario deniega el permiso una sola vez, la app queda permanentemente bloqueada. La consulta inicial debe ser puramente pasiva mediante `getForegroundPermissionsAsync()`.

#### Comparativa de Código (Diff Técnico):

```diff
- // Mala práctica propuesta por la IA (Pedir permiso al arrancar)
- useEffect(() => {
-   Location.requestForegroundPermissionsAsync().then((res) => {
-     setPermission(res.granted ? 'granted' : 'denied');
-   });
- }, []);

+ // Solución implementada (Consulta pasiva + solicitud en contexto)
+ useEffect(() => {
+   let cancelled = false;
+   // Solo consulta el estado actual sin mostrar diálogo invasivo
+   Location.getForegroundPermissionsAsync()
+     .then((res) => {
+       if (!cancelled) setState((s) => ({ ...s, permission: mapPermission(res) }));
+     })
+     .catch(() => {
+       if (!cancelled) setState((s) => ({ ...s, permission: 'denied' }));
+     });
+   return () => { cancelled = true; };
+ }, []);
+
+ // La solicitud real solo se ejecuta cuando el usuario pulsa el botón
+ const requestPermission = useCallback(async (): Promise<boolean> => {
+   const res = await Location.requestForegroundPermissionsAsync();
+   setState((s) => ({ ...s, permission: mapPermission(res) }));
+   return res.granted;
+ }, []);
```

---

## 3. Catálogo Detallado de Alucinaciones y Errores Detectados

### Caso 1: API de Cámara Deprecada
* **Alucinación:** `import { Camera } from 'expo-camera'` con llamadas a `Camera.requestCameraPermissionsAsync()`.
* **Causa:** Los modelos de lenguaje fueron entrenados con versiones legacy de Expo (SDK 48-50) donde la clase `Camera` era el estándar.
* **Impacto:** En el SDK 51+ y la New Architecture, dicha API fue retirada en favor de componentes modulares.
* **Corrección:** Se migró a `CameraView` y al hook oficial `useCameraPermissions()`.

### Caso 2: Violación de Jerarquía en `<CameraView>`
* **Alucinación:** La IA intentó estructurar controles de disparo como hijos directos:
  ```tsx
  <CameraView>
    <Pressable onPress={takePhoto}><Text>Disparar</Text></Pressable>
  </CameraView>
  ```
* **Causa:** En versiones antiguas de `expo-camera`, el componente admitía elementos hijos.
* **Impacto:** `CameraView` moderno no soporta componentes hijos directos, generando fallas visuales y bloqueos de eventos táctiles en Android e iOS.
* **Corrección:** Se implementaron los controles como componentes hermanos superpuestos utilizando posición absoluta (`StyleSheet.absoluteFill`).

### Caso 3: Constantes Deprecadas en `ImagePicker`
* **Alucinación:** `mediaTypes: ImagePicker.MediaTypeOptions.Images`.
* **Causa:** La enumeración `MediaTypeOptions` fue declarada obsoleta en las últimas versiones del SDK.
* **Corrección:** Uso del arreglo directo de cadenas: `mediaTypes: ['images']`.

### Caso 4: Fuga de Recursos por Suscripciones Asíncronas Huérfanas
* **Alucinación:**
  ```tsx
  useEffect(() => {
    Location.watchPositionAsync({}, (loc) => setCoords(loc.coords));
  }, []);
  ```
* **Impacto Crítico:** 
  1. No guarda la referencia para ejecutar `subscription.remove()`, dejando el GPS activo indefinidamente.
  2. Como `watchPositionAsync` es una promesa asíncrona, si el usuario abandona la pantalla antes de resolverse, la suscripción se inicia pero no se puede cancelar (suscripción huérfana).
* **Corrección:** Se implementó el patrón de bandera booleana `let cancelled = false;` evaluada en el callback `.then(sub => if (cancelled) sub.remove())`.

### Caso 5: Excepción Nativa en Entorno Web (`expo-sensors`)
* **Alucinación / Error de Módulo:** En navegadores de escritorio, `Accelerometer.isAvailableAsync()` retornaba `true`, pero el módulo `ExponentAccelerometer.web.js` carece del método `addListener`, arrojando:
  ```text
  TypeError: this._nativeModule.addListener is not a function
  ```
* **Corrección:** Se agregó la guarda condicional `Platform.OS === 'web'` en `useShake.ts` junto con un bloque `try/catch` para desactivar el sensor con degradación elegante en la web y no bloquear el flujo de desarrollo.

---

## 4. Matriz Oficial de Auditoría: Código IA vs. Estándar Expo SDK 57

| Característica / API | Generado por la IA | Problema Técnico | Estándar Oficial Implementado |
| :--- | :--- | :--- | :--- |
| **Acceso a Cámara** | `import { Camera } from 'expo-camera'` | API heredada y deprecada en SDK 51+ | `import { CameraView, useCameraPermissions } from 'expo-camera'` |
| **Gestión de Permisos** | `import * as Permissions from 'expo-permissions'` | Paquete eliminado del núcleo de Expo | Permisos independientes por módulo (`Location.requestForegroundPermissionsAsync()`) |
| **Selector de Medios** | `mediaTypes: ImagePicker.MediaTypeOptions.Images` | Propiedad obsoleta | `mediaTypes: ['images']` |
| **Estructura de Cámara** | Botones e interfaces dentro de `<CameraView>` | Sin soporte de hijos en `CameraView` | Controles superpuestos en posición absoluta con z-index |
| **Limpieza de Hardware** | `watchPositionAsync` sin función de cleanup | Consumo continuo de batería y GPS activo | Retorno de función de limpieza con `.remove()` y bandera `cancelled` |
| **Estrategia de Permisos** | Solicitar todo en el `useEffect` de montaje | Rechazo prematuro por el usuario (especialmente en iOS) | Petición contextual mediada por el componente `PermissionPrimer` |
| **Instalación de Paquetes** | `npm install expo-camera expo-location` | Incompatibilidad de versiones menores con el SDK | `npx expo install expo-camera expo-location` |
| **Alcance de Ubicación** | `requestBackgroundPermissionsAsync` para fotos | Permiso intrusivo que ocasiona rechazo en Google Play | Exclusivamente ubicación en primer plano (`Foreground`) |

---

## 5. Conclusiones y Aprendizajes

1. **La IA tiende a desactualizarse en frameworks móviles:** Los modelos de IA suelen generar código correspondiente a versiones anteriores de Expo (SDK 48 a 50). Es indispensable cotejar siempre las respuestas contra la documentación oficial de la versión instalada (`expo` en `package.json`).
2. **El hardware exige ciclo de vida responsable:** El acceso a sensores físicos (cámara, acelerómetro, GPS) no puede tratarse como peticiones asíncronas aisladas; toda suscripción iniciada debe liberarse explícitamente para preservar la batería y memoria del dispositivo.
3. **La arquitectura de tipos protege la experiencia de usuario:** Tipar `coords: Coords | null` en TypeScript obligó al sistema de tipos a validar en cada pantalla el escenario en que no existe señal de GPS, garantizando una degradación elegante sin cierres inesperados de la aplicación.
