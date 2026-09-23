import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { C, R } from '../../lib/theme';

export default function LoginScreen() {
  const { loginWithPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await loginWithPassword(email.trim(), password);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 401
            ? 'Invalid email or password. Please try again.'
            : `Server error (${err.status}). Please try again.`
          : 'Connection failed. Check your network and try again.';
      Alert.alert('Sign in failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🌿</Text>
          </View>
          <Text style={styles.appName}>LabourBook</Text>
          <Text style={styles.tagline}>Farm Labour Manager</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.heading}>Sign in to your farm</Text>
          <Text style={styles.subHeading}>Enter your account credentials below</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholderTextColor={C.outline}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              placeholderTextColor={C.outline}
            />
          </View>

          <Pressable
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.onPrimary} />
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Secure • Multi-tenant • Offline-ready
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: R.xl,
    backgroundColor: C.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  logoIcon: { fontSize: 32 },
  appName: { fontSize: 28, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: C.onSurfaceVariant, marginTop: 3 },
  card: {
    backgroundColor: C.surfaceLowest,
    borderRadius: R.xxl,
    padding: 24,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  heading: { fontSize: 20, fontWeight: '700', color: C.primary, marginBottom: 4 },
  subHeading: { fontSize: 13, color: C.onSurfaceVariant, marginBottom: 22 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: C.onSurfaceVariant, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: C.outlineVariant,
    borderRadius: R.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: C.onSurface,
    backgroundColor: C.surfaceLow,
  },
  btn: {
    height: 50,
    backgroundColor: C.primaryContainer,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '700', color: C.onPrimary, letterSpacing: 0.2 },
  footer: { textAlign: 'center', fontSize: 11, color: C.outline, marginTop: 28 },
});
