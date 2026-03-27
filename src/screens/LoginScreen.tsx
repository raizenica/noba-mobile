import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import {colors, spacing, borderRadius, fontSize} from '../theme/colors';
import {post as apiPost, isConfigured, getServerUrl} from '../services/api';
import {useAuthStore, AuthMethod} from '../store/authStore';

export default function LoginScreen() {
  const {setServerUrl, setAuth, setMethods, methods} = useAuthStore();
  const [serverInput, setServerInput] = useState(getServerUrl() || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(
    isConfigured(),
  );

  // Fetch capabilities when server URL is confirmed (on blur)
  const loadCapabilities = useCallback(
    async (url: string) => {
      if (!url.trim()) {
        return;
      }
      try {
        await setServerUrl(url.trim());
        const base = url.trim().replace(/\/+$/, '');
        const resp = await fetch(`${base}/api/auth/capabilities`, {
          headers: {Accept: 'application/json'},
        });
        if (resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json.methods)) {
            setMethods(json.methods);
          }
        }
      } catch {
        // Non-fatal — falls back to local method (already the default)
      }
      setCapabilitiesLoaded(true);
    },
    [setServerUrl, setMethods],
  );

  // Handle SAML deep link return: noba://auth?code=xxx
  useEffect(() => {
    const handleUrl = async ({url}: {url: string}) => {
      if (!url.startsWith('noba://auth')) {
        return;
      }
      const codeMatch = url.match(/[?&]code=([^&]+)/);
      if (!codeMatch) {
        return;
      }
      const code = decodeURIComponent(codeMatch[1]);
      try {
        setLoading(true);
        setError('');
        const data = (await apiPost('/api/auth/exchange', {code})) as any;
        if (data?.token) {
          await setAuth(data.token);
        } else {
          throw new Error('No token in exchange response');
        }
      } catch (e: any) {
        setError('SSO failed: ' + (e.message || 'unknown error'));
        setLoading(false);
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);
    // Handle cold-start deep link (app launched via deep link while closed)
    Linking.getInitialURL().then(url => {
      if (url) {
        handleUrl({url});
      }
    });
    return () => sub.remove();
  }, [setAuth]);

  const handleLocalLogin = async () => {
    setError('');
    setLoading(true);
    try {
      if (!serverInput.trim()) {
        throw new Error('Enter your NOBA server URL');
      }
      if (!capabilitiesLoaded) {
        await loadCapabilities(serverInput);
      }
      const body: any = {username: username.trim(), password};
      if (needs2fa && totpCode) {
        body.totp_code = totpCode.trim();
      }
      const data = (await apiPost('/api/login', body)) as any;
      if (data.requires_2fa && !needs2fa) {
        setNeeds2fa(true);
        setLoading(false);
        return;
      }
      if (data.token) {
        await setAuth(data.token);
      } else {
        throw new Error('No token received');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSamlLogin = async (method: AuthMethod) => {
    if (!serverInput.trim()) {
      setError('Enter your NOBA server URL first');
      return;
    }
    const base = serverInput.trim().replace(/\/+$/, '');
    const samlUrl = `${base}/api/saml/login?redirect_uri=${encodeURIComponent(
      'noba://auth',
    )}`;
    await Linking.openURL(samlUrl);
  };

  const samlMethods = methods.filter(m => m.type !== 'local');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>NOBA</Text>
          <Text style={styles.subtitle}>Command Center</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverInput}
            onChangeText={setServerInput}
            onBlur={() => loadCapabilities(serverInput)}
            placeholder="https://noba.example.com"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="********"
            placeholderTextColor={colors.textDim}
            secureTextEntry
          />

          {needs2fa && (
            <>
              <Text style={styles.label}>2FA Code</Text>
              <TextInput
                style={styles.input}
                value={totpCode}
                onChangeText={setTotpCode}
                placeholder="123456"
                placeholderTextColor={colors.textDim}
                keyboardType="number-pad"
                maxLength={6}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLocalLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>
                {needs2fa ? 'Verify & Sign In' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {samlMethods.map(method => (
            <TouchableOpacity
              key={method.type}
              style={[styles.button, styles.buttonSSO]}
              onPress={() => handleSamlLogin(method)}
              disabled={loading}>
              <Text style={styles.buttonText}>{method.display_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {flexGrow: 1, justifyContent: 'center', padding: spacing.xl},
  logoContainer: {alignItems: 'center', marginBottom: spacing.xxl},
  logo: {
    fontSize: fontSize.title,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  form: {width: '100%'},
  label: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonSSO: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: spacing.md,
  },
  buttonDisabled: {opacity: 0.6},
  buttonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
