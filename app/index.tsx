// app/index.tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;

  // Redirige según el estado de la sesión
  return <Redirect href={session ? '/(tabs)/inicio' : '/login'} />;
}
