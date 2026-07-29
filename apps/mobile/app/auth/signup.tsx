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

export default function SignupScreen() {
  const colors = useColors();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : 0;

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    try {
      setLoading(true);
      await signUp(email.trim().toLowerCase(), password);
      Alert.alert(
        'Check your email',
        'We sent you a confirmation link. Click it to activate your account.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert('Sign up failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]} hitSlop={10}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={[styles.wordmark, { color: colors.primary }]}>Zola</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Create your account.</Text>

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
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        <Pressable
          onPress={handleSignUp}
          style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          disabled={loading}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
            {loading ? 'Creating account…' : 'Create Account'}
          </Text>
        </Pressable>

        <View style={styles.loginRow}>
          <Text style={[styles.loginHint, { color: colors.mutedForeground }]}>Already have an account?</Text>
          <Pressable onPress={() => router.replace('/auth/login')} hitSlop={6}>
            <Text style={[styles.loginLink, { color: colors.primary }]}>Sign in</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 10 },
  form: { padding: 28, gap: 24, flexGrow: 1 },
  wordmark: { fontSize: 40, fontFamily: 'Spectral_600SemiBold', letterSpacing: -0.5, marginTop: 12 },
  tagline: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: -8 },
  fields: { gap: 12 },
  fieldWrap: { borderRadius: 10, borderWidth: 1, padding: 14 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.5, marginBottom: 6 },
  input: { fontSize: 16, fontFamily: 'Inter_400Regular', padding: 0 },
  btn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  loginHint: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  loginLink: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
