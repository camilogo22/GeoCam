// hooks/useShake.ts
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

interface UseShakeOptions {
  threshold?: number;   // Magnitud para detonar (por defecto 1.78g)
  cooldownMs?: number;  // Tiempo de espera entre disparos (por defecto 1000ms)
}

export function useShake(
  onShake: () => void,
  options: UseShakeOptions = {}
): { isAvailable: boolean | null } {
  const { threshold = 1.78, cooldownMs = 1000 } = options;
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Guardamos onShake en ref para que cambiar el callback no reinicie la suscripción del acelerómetro
  const callbackRef = useRef(onShake);
  callbackRef.current = onShake;

  const lastShakeTime = useRef<number>(0);

  useEffect(() => {
    // El acelerómetro físico solo existe en Android e iOS; en web se desactiva elegantemente
    if (Platform.OS === 'web') {
      setIsAvailable(false);
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        setIsAvailable(available);

        if (!available) return;

        try {
          Accelerometer.setUpdateInterval(100); // 100 ms recomendado en la guía

          subscription = Accelerometer.addListener(({ x, y, z }) => {
            // En reposo, la gravedad terrestre suma aproximadamente 1g
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            const now = Date.now();

            if (magnitude > threshold && now - lastShakeTime.current > cooldownMs) {
              lastShakeTime.current = now;
              callbackRef.current();
            }
          });
        } catch {
          // Si el hardware no implementa addListener
          setIsAvailable(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAvailable(false);
        }
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [threshold, cooldownMs]);

  return { isAvailable };
}
