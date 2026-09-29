# Registro de Auditoria de Inteligencia Artificial (AI-LOG)

> **Materia:** Desarrollo Movil — Taller Integrador 2  
> **Semana:** 6 — Modulos Nativos y Sensores del Dispositivo  
> **Proyecto:** GeoCam  
> **Estudiante:** **Camilo Gomez**  
> **Docente de referencia:** @AntonioJGL  
> **Ecosistema:** Expo SDK 57 | React Native 0.86 (New Architecture) | TypeScript

---

> [!NOTE]
> Este documento registra de manera formal la auditoria tecnica realizada sobre el codigo asistido por IA durante el desarrollo del proyecto **GeoCam**. Su objetivo es identificar alucinaciones, APIs obsoletas y malas practicas en el acceso a hardware nativo, documentando las correcciones implementadas segun los estandares modernos de Expo.

---

## 1. Prompts Utilizados y Objetivos Tecnicos

| # | Prompt Ejecutado | Objetivo Tecnico | Resultado Obtenido |
| :---: | :--- | :--- | :--- |
| **P1** | *"Escribe un Custom Hook en React Native con TypeScript que detecte cuando el usuario agita el telefono usando expo-sensors, con umbral configurable y prevencion de fugas de memoria."* | Encapsular el acelerometro con frecuencia controlada, calculo vectorial y limpieza de suscripcion. | Genero un hook funcional pero con errores criticos de frecuencia de muestreo y sin proteccion contra suscripciones huerfanas. |
| **P2** | *"Implementa un hook useCamera con la nueva API de Expo Camera (CameraView) que evite colapsos por doble pulsacion y permita alternar entre camara frontal y trasera."* | Manejar el ciclo de camara nativa con estados de preparacion (`onCameraReady`) y guarda de concurrencia. | Propuso la sintaxis moderna pero intento anidar controles hijos dentro del componente `<CameraView>`. |
| **P3** | *"Crea un hook useGeoLocation con maquina de estados de permisos completa (checking, undetermined, granted, denied, blocked) y degradacion elegante si el usuario rechaza el GPS."* | Implementar el flujo UX recomendado por Apple y Google: consulta pasiva inicial y solicitud explicita bajo demanda. | Propuso solicitar permisos de inmediato en el montaje del componente, violando las pautas de UX movil. |

---

## 2. Analisis Comparativo: Codigo Generado vs. Codigo Modificado

### 2.1 Sensor de Agitado (`hooks/useShake.ts`)

> [!WARNING]
> **Deficiencia de la IA:** La IA omitio configurar el intervalo de actualizacion del sensor (`setUpdateInterval`), lo que provoca que el acelerometro opere a maxima frecuencia (hasta 200 Hz en Android), drenando la bateria en minutos. Ademas, no implemento tiempo de enfriamiento (cooldown), disparando el callback decenas de veces con un solo movimiento fisico.

#### Comparativa de Codigo (Diff Tecnico):

```diff
- // Codigo generado inicialmente por la IA
- useEffect(() => {
-   const subscription = Accelerometer.addListener(({ x, y, z }) => {
-     const total = Math.sqrt(x * x + y * y + z * z);
-     if (total > 1.78) {
-       onShake(); // Se dispara 20-30 veces por cada sacudida
-     }
-   });
-   return () => subscription.remove();
- }, [onShake]); // Recrea el listener nativo en cada re-render

+ // Codigo refactorizado y corregido
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
+     Accelerometer.setUpdateInterval(100); // 100 ms: balance optimo bateria/gesto
+
+     subscription = Accelerometer.addListener(({ x, y, z }) => {
+       const magnitude = Math.sqrt(x * x + y * y + z * z);
+       const now = Date.now();
+       // Filtro con cooldown de 1000 ms para evento unico
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

### 2.2 Ciclo de Permisos y Degradacion de GPS (`hooks/useGeoLocation.ts`)

> [!IMPORTANT]
> **Regla de UX de Autorizacion:** Nunca se deben pedir permisos en el evento de montaje de la pantalla. En iOS, si el usuario deniega el permiso una sola vez, la app queda permanentemente bloqueada. La consulta inicial debe ser puramente pasiva mediante `getForegroundPermissionsAsync()`.

#### Comparativa de Codigo (Diff Tecnico):

```diff
- // Mala practica propuesta por la IA (Pedir permiso al arrancar)
- useEffect(() => {
-   Location.requestForegroundPermissionsAsync().then((res) => {
-     setPermission(res.granted ? 'granted' : 'denied');
-   });
- }, []);

+ // Solucion implementada (Consulta pasiva + solicitud en contexto)
+ useEffect(() => {
+   let cancelled = false;
+   // Solo consulta el estado actual sin mostrar dialogo invasivo
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
+ // La solicitud real solo se ejecuta cuando el usuario pulsa el boton
+ const requestPermission = useCallback(async (): Promise<boolean> => {
+   const res = await Location.requestForegroundPermissionsAsync();
+   setState((s) => ({ ...s, permission: mapPermission(res) }));
+   return res.granted;
+ }, []);
```

---

## 3. Catalogo Detallado de Alucinaciones y Errores Detectados

### Caso 1: API de Camara Deprecada
* **Alucinacion:** `import { Camera } from 'expo-camera'` con llamadas a `Camera.requestCameraPermissionsAsync()`.
* **Causa:** Los modelos de lenguaje fueron entrenados con versiones legacy de Expo (SDK 48-50) donde la clase `Camera` era el estandar.
* **Impacto:** En el SDK 51+ y la New Architecture, dicha API fue retirada en favor de componentes modulares.
* **Correccion:** Se migro a `CameraView` y al hook oficial `useCameraPermissions()`.

### Caso 2: Violacion de Jerarquia en `<CameraView>`
* **Alucinacion:** La IA intento estructurar controles de disparo como hijos directos:
  ```tsx
  <CameraView>
    <Pressable onPress={takePhoto}><Text>Disparar</Text></Pressable>
  </CameraView>
  ```
* **Causa:** En versiones antiguas de `expo-camera`, el componente admitia elementos hijos.
* **Impacto:** `CameraView` moderno no soporta componentes hijos directos, generando fallas visuales y bloqueos de eventos tactiles en Android e iOS.
* **Correccion:** Se implementaron los controles como componentes hermanos superpuestos utilizando posicion absoluta (`StyleSheet.absoluteFill`).

### Caso 3: Constantes Deprecadas en `ImagePicker`
* **Alucinacion:** `mediaTypes: ImagePicker.MediaTypeOptions.Images`.
* **Causa:** La enumeracion `MediaTypeOptions` fue declarada obsoleta en las ultimas versiones del SDK.
* **Correccion:** Uso del arreglo directo de cadenas: `mediaTypes: ['images']`.

### Caso 4: Fuga de Recursos por Suscripciones Asincronas Huerfanas
* **Alucinacion:**
  ```tsx
  useEffect(() => {
    Location.watchPositionAsync({}, (loc) => setCoords(loc.coords));
  }, []);
  ```
* **Impacto Critico:** 
  1. No guarda la referencia para ejecutar `subscription.remove()`, dejando el GPS activo indefinidamente.
  2. Como `watchPositionAsync` es una promesa asincrona, si el usuario abandona la pantalla antes de resolverse, la suscripcion se inicia pero no se puede cancelar (suscripcion huerfana).
* **Correccion:** Se implemento el patron de bandera booleana `let cancelled = false;` evaluada en el callback `.then(sub => if (cancelled) sub.remove())`.

### Caso 5: Excepcion Nativa en Entorno Web (`expo-sensors`)
* **Alucinacion / Error de Modulo:** En navegadores de escritorio, `Accelerometer.isAvailableAsync()` retornaba `true`, pero el modulo `ExponentAccelerometer.web.js` carece del metodo `addListener`, arrojando:
  ```text
  TypeError: this._nativeModule.addListener is not a function
  ```
* **Correccion:** Se agrego la guarda condicional `Platform.OS === 'web'` en `useShake.ts` junto con un bloque `try/catch` para desactivar el sensor con degradacion elegante en la web y no bloquear el flujo de desarrollo.

---

## 4. Matriz Oficial de Auditoria: Codigo IA vs. Estandar Expo SDK 57

| Caracteristica / API | Generado por la IA | Problema Tecnico | Estandar Oficial Implementado |
| :--- | :--- | :--- | :--- |
| **Acceso a Camara** | `import { Camera } from 'expo-camera'` | API heredada y deprecada en SDK 51+ | `import { CameraView, useCameraPermissions } from 'expo-camera'` |
| **Gestion de Permisos** | `import * as Permissions from 'expo-permissions'` | Paquete eliminado del nucleo de Expo | Permisos independientes por modulo (`Location.requestForegroundPermissionsAsync()`) |
| **Selector de Medios** | `mediaTypes: ImagePicker.MediaTypeOptions.Images` | Propiedad obsoleta | `mediaTypes: ['images']` |
| **Estructura de Camara** | Botones e interfaces dentro de `<CameraView>` | Sin soporte de hijos en `CameraView` | Controles superpuestos en posicion absoluta con z-index |
| **Limpieza de Hardware** | `watchPositionAsync` sin funcion de cleanup | Consumo continuo de bateria y GPS activo | Retorno de funcion de limpieza con `.remove()` y bandera `cancelled` |
| **Estrategia de Permisos** | Solicitar todo en el `useEffect` de montaje | Rechazo prematuro por el usuario (especialmente en iOS) | Peticion contextual mediada por el componente `PermissionPrimer` |
| **Instalacion de Paquetes** | `npm install expo-camera expo-location` | Incompatibilidad de versiones menores con el SDK | `npx expo install expo-camera expo-location` |
| **Alcance de Ubicacion** | `requestBackgroundPermissionsAsync` para fotos | Permiso intrusivo que ocasiona rechazo en Google Play | Exclusivamente ubicacion en primer plano (`Foreground`) |

---

## 5. Conclusiones y Aprendizajes

1. **La IA tiende a desactualizarse en frameworks moviles:** Los modelos de IA suelen generar codigo correspondiente a versiones anteriores de Expo (SDK 48 a 50). Es indispensable cotejar siempre las respuestas contra la documentacion oficial de la version instalada (`expo` en `package.json`).
2. **El hardware exige ciclo de vida responsable:** El acceso a sensores fisicos (camara, acelerometro, GPS) no puede tratarse como peticiones asincronas aisladas; toda suscripcion iniciada debe liberarse explicitamente para preservar la bateria y memoria del dispositivo.
3. **La arquitectura de tipos protege la experiencia de usuario:** Tipar `coords: Coords | null` en TypeScript obligo al sistema de tipos a validar en cada pantalla el escenario en que no existe senal de GPS, garantizando una degradacion elegante sin cierres inesperados de la aplicacion.
