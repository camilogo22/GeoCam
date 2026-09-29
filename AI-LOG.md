# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Estudiante Móvil  
**Semana:** 6  
**Proyecto:** GeoCam – Taller Integrador 2 (Módulos Nativos y Sensores del Dispositivo)  

---

## 1. Prompts Utilizados
- *"Escribe un Custom Hook en React Native con TypeScript que detecte cuando el usuario agita el teléfono usando expo-sensors, con umbral configurable, frecuencia de actualización controlada y prevención de memory leaks."*
- *"Implementa un hook en Expo para gestionar la cámara frontal/trasera y captura de fotografías con prevención de doble pulsación en Android usando la nueva arquitectura."*
- *"Crea un hook useGeoLocation en Expo con máquina de estados de permisos (checking, undetermined, granted, denied, blocked), consulta bajo demanda, watchPositionAsync y degradación elegante si el permiso es rechazado."*

---

## 2. Código Generado vs. Código Modificado

### 2.1 Sensor de Agitado (`hooks/useShake.ts`)
- **¿Qué generó la IA?:** Un hook que invocaba `Accelerometer.addListener` directamente dentro del callback de `useEffect` sin verificar disponibilidad del sensor, sin definir `setUpdateInterval` (ejecutándose a máxima frecuencia y agotando batería), disparando el callback decenas de veces por cada sacudida física y recreando la suscripción en cada render.
- **¿Qué modifiqué/corregí?:**
  1. Agregué verificación previa con `await Accelerometer.isAvailableAsync()`.
  2. Fijé el intervalo de actualización a 100 ms (`Accelerometer.setUpdateInterval(100)`).
  3. Almacené el callback `onShake` en un `useRef` para evitar reiniciar la suscripción nativa innecesariamente.
  4. Implementé un tiempo de enfriamiento (`cooldownMs: 1000`) para registrar una única acción por sacudida.
  5. Aseguré la limpieza de la suscripción con `subscription?.remove()` y bandera `cancelled = true`.

### 2.2 Ciclo de Permisos de Ubicación (`hooks/useGeoLocation.ts`)
- **¿Qué generó la IA?:** Una llamada a `Location.requestForegroundPermissionsAsync()` tan pronto como el componente se montaba en pantalla.
- **¿Qué modifiqué/corregí?:** Apliqué el principio de buenas prácticas de UX de la guía: al montar el componente solo se debe **consultar** el estado previo con `Location.getForegroundPermissionsAsync()`, reservando la solicitud explícita (`requestForegroundPermissionsAsync()`) únicamente cuando el usuario presione un botón de acción en pantalla.

---

## 3. Alucinaciones o Errores Detectados

1. **Alucinación 1 (API de Cámara Deprecada):**  
   - *Error de la IA:* Usó `import { Camera } from 'expo-camera'` e invocó `Camera.requestCameraPermissionsAsync()`.  
   - *Corrección:* En las versiones modernas de Expo, el componente obsoleto `Camera` fue reemplazado por `CameraView` y el hook `useCameraPermissions()`.

2. **Alucinación 2 (Jerarquía de Componentes de Cámara):**  
   - *Error de la IA:* Intentó anidar los controles de disparo y la barra inferior directamente como hijos dentro de `<CameraView> ... </CameraView>`.  
   - *Corrección:* `CameraView` no admite componentes hijos. Los controles se implementaron como hermanos superpuestos utilizando posición absoluta (`StyleSheet.absoluteFill` y `position: 'absolute'`).

3. **Alucinación 3 (Sintaxis obsoleta de ImagePicker):**  
   - *Error de la IA:* Intentó configurar el selector de imágenes con `mediaTypes: ImagePicker.MediaTypeOptions.Images`.  
   - *Corrección:* Se actualizó a la sintaxis del SDK actual: `mediaTypes: ['images']`.

4. **Alucinación 4 (Suscripciones huérfanas en llamadas asíncronas):**  
   - *Error de la IA:* Omitió la bandera `cancelled` en la resolución de `Location.watchPositionAsync()`.  
   - *Corrección:* Al ser una llamada asíncrona, si el usuario sale de la pantalla antes de resolverse la promesa, la suscripción quedaba huérfana y continuaba consumiendo GPS. Se agregó la guarda `if (cancelled) sub.remove()`.

5. **Error detectado 5 (Incompatibilidad de expo-sensors en Web):**  
   - *Problema:* Al ejecutar la app en navegador web, `Accelerometer.isAvailableAsync()` resolvía en verdadero pero `ExponentAccelerometer.web.js` carece del método `addListener`, arrojando `TypeError: this._nativeModule.addListener is not a function`.  
   - *Corrección:* Se integró una comprobación `Platform.OS === 'web'` en `hooks/useShake.ts` junto con un bloque `try/catch` de contingencia para desactivar el sensor con degradación elegante cuando se pruebe desde un navegador.

---

## 4. Matriz de Auditoría Oficial: Código IA vs Corrección

| Lo que la IA suele generar | Problema Técnico | Corrección Implementada |
| :--- | :--- | :--- |
| `import { Camera } from 'expo-camera'` con `Camera.requestCameraPermissionsAsync()` | API antigua, reemplazada y deprecada | `CameraView` + `useCameraPermissions()` |
| `import * as Permissions from 'expo-permissions'` | Paquete obsoleto y retirado del core de Expo | Permisos desde cada módulo nativo (ej. `Location.requestForegroundPermissionsAsync()`) |
| `mediaTypes: ImagePicker.MediaTypeOptions.Images` | Opción obsoleta en SDK actual | `mediaTypes: ['images']` |
| Controles de botones como hijos directos de `<CameraView>` | No soportado, comportamiento inconsistente y fallas visuales | Controles hermanos superpuestos con posición absoluta (`StyleSheet.absoluteFill`) |
| `watchPositionAsync` o `addListener` sin `.remove()` | Fuga de batería y memoria (hilos nativos huérfanos) | Cleanup en `useEffect` con bandera `cancelled = true` y `sub.remove()` |
| Pedir todos los permisos de golpe al iniciar la app | Mala UX; en iOS se pierde la única oportunidad | Pedir en contexto con pantalla previa explicativa (`PermissionPrimer`) |
| `npm install expo-camera` | Posible versión incompatible con el SDK de Expo | `npx expo install expo-camera` |
| `requestBackgroundPermissionsAsync` para etiquetar fotos | Permiso excesivo e innecesario, rechazo en tiendas | Solo permisos de primer plano (`getForegroundPermissionsAsync`) |

