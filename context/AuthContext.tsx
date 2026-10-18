// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Carga de sesión inicial
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setIsLoading(false);
    });

    // Se dispara al suscribirse y en cada login, logout o refresco de token
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    session,
    user: session?.user ?? null,
    isLoading,
    // Devuelven mensaje de error o null si fue exitoso
    signIn: async (email, password) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        return error?.message ?? null;
      } catch (err) {
        return err instanceof Error ? err.message : 'Error inesperado al iniciar sesión';
      }
    },
    signUp: async (email, password) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) return error.message;
        return data.session ? null : 'Revisa tu correo para confirmar la cuenta.';
      } catch (err) {
        return err instanceof Error ? err.message : 'Error inesperado al registrar usuario';
      }
    },
    signOut: async () => {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error al cerrar sesión:', err);
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

