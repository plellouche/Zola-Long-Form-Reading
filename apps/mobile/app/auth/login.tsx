import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : 0;

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      await signIn(email.trim().toLowerCase(), password);
      router.back();
    } catch (e) {
      Alert.alert('Sign in failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
          hitSlop={10}
        >
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        {/* Wordmark */}
        <Text style={[styles.wordmark, { color: colors.primary }]}>Zola</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Essays worth your evening.
        </Text>

        {/* Fields */}
        <View style={styles.fields}>
          <View style={[styles.fieldWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Email</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              autoCorrect={false}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={[styles.fieldWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { color: colors.foreground, flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Sign in button */}
        <Pressable
          onPress={handleSignIn}
          style={({ pressed }) => [
            styles.signInBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          disabled={loading}
        >
          <Text style={[styles.signInText, { color: colors.primaryForeground }]}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Text>
        </Pressable>

        {/* Sign up link */}
        <View style={styles.signUpRow}>
          <Text style={[styles.signUpHint, { color: colors.mutedForeground }]}>
            New to Zola?
          </Text>
          <Pressable onPress={() => router.replace('/auth/signup')} hitSlop={6}>
            <Text style={[styles.signUpLink, { color: colors.primary }]}>Create account</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' },
  form: { padding: 28, gap: 24, flexGrow: 1 },
  wordmark: { fontSize: 40, fontFamily: 'Spectral_600SemiBold', letterSpacing: -0.5, marginTop: 12 },
  tagline: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: -8 },
  fields: { gap: 12 },
  fieldWrap: { borderRadius: 10, borderWidth: 1, padding: 14 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.5, marginBottom: 6 },
  input: { fontSize: 16, fontFamily: 'Inter_400Regular', padding: 0 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signInBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  signInText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  signUpRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  signUpHint: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  signUpLink: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
