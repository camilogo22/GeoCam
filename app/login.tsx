// app/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (action: typeof signIn, isRegister = false) => {
    setMessage(null);
    setIsSuccess(false);

    if (!email.trim() || password.length < 6) {
      setMessage('Escribe tu correo y una contraseña de al menos 6 caracteres.');
      return;
    }

    setBusy(true);
    const result = await action(email, password);
    setBusy(false);

    if (result) {
      setMessage(result);
      if (isRegister && result.includes('correo')) {
        setIsSuccess(true);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="camera" size={36} color="#10b981" />
          </View>

          <Text style={styles.title}>GeoCam Cloud</Text>
          <Text style={styles.subtitle}>
            Inicia sesión o regístrate para sincronizar tus fotos geolocalizadas en Supabase
          </Text>

          {message && (
            <View
              style={[
                styles.messageBox,
                isSuccess ? styles.messageBoxSuccess : styles.messageBoxError,
              ]}
            >
              <Ionicons
                name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={isSuccess ? '#10b981' : '#ef4444'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.messageText,
                  isSuccess ? styles.messageTextSuccess : styles.messageTextError,
                ]}
              >
                {message}
              </Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Correo electrónico</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#737373" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="ejemplo@correo.com"
                placeholderTextColor="#525252"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contraseña (mínimo 6 caracteres)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#737373"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#525252"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <Pressable
            style={[styles.primaryButton, busy && styles.buttonDisabled]}
            disabled={busy}
            onPress={() => submit(signIn, false)}
          >
            {busy ? (
              <ActivityIndicator color="#0a0a0a" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#0a0a0a" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Iniciar Sesión</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, busy && styles.buttonDisabled]}
            disabled={busy}
            onPress={() => submit(signUp, true)}
          >
            <Ionicons
              name="person-add-outline"
              size={18}
              color="#10b981"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.secondaryButtonText}>Crear Nueva Cuenta</Text>
          </Pressable>

          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#525252" />
            <Text style={styles.footerNoteText}>
              Sesión protegida por fragmentos en Expo SecureStore y Row Level Security
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#171717',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#14251e',
    borderWidth: 1,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#a3a3a3',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
  },
  messageBoxError: {
    backgroundColor: '#261215',
    borderColor: '#ef4444',
  },
  messageBoxSuccess: {
    backgroundColor: '#14251e',
    borderColor: '#10b981',
  },
  messageText: {
    fontSize: 13,
    flex: 1,
  },
  messageTextError: {
    color: '#f87171',
  },
  messageTextSuccess: {
    color: '#34d399',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    color: '#d4d4d4',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 12,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#0a0a0a',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#262626',
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
    paddingHorizontal: 8,
  },
  footerNoteText: {
    color: '#737373',
    fontSize: 11,
    textAlign: 'center',
    flex: 1,
  },
});

