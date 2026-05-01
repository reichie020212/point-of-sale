/**
 * Pair this device.
 *
 * Manual code entry against the 12-char CNTR-XXXX-XXXX issued by the
 * web /registers screen. On success we:
 *   1. Persist the token via expo-secure-store (setDeviceToken).
 *   2. Cache the device identity in the in-memory zustand slice so
 *      settings can show it without re-reading the token.
 *   3. Bounce back to /sell.
 *
 * QR-scan entry is deliberately deferred — it requires a Camera-
 * permission scaffold we haven't taken on yet (open question in the
 * Blueprint). Pasting the 12 chars works on every Expo build today.
 */
import { nativeTheme } from '@counter/tokens/native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, apiCalls, setDeviceToken } from '../src/api/client';
import { useDevice } from '../src/state/device';

const CODE_REGEX = /^CNTR-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export default function PairScreen() {
  const setIdentity = useDevice((s) => s.set);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmed = code.trim().toUpperCase();
  const valid = CODE_REGEX.test(trimmed);

  const onSubmit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiCalls.pair({
        code: trimmed,
        name: name.trim().length > 0 ? name.trim() : undefined,
      });
      await setDeviceToken(res.token);
      setIdentity({
        deviceId: res.device.id,
        deviceName: res.device.name,
        orgId: res.device.orgId,
      });
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else setError(err instanceof Error ? err.message : 'pair failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Pair this device</Text>
      <Text style={styles.body}>
        On a paired computer, open the dashboard, go to Registers → Pair new device, and
        type the code below.
      </Text>

      <Text style={styles.label}>Pairing code</Text>
      <TextInput
        style={[styles.input, styles.code]}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="CNTR-XXXX-XXXX"
        placeholderTextColor={nativeTheme.colors.ink3}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={14}
      />

      <Text style={styles.label}>Device name (optional)</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Counter at the door"
        placeholderTextColor={nativeTheme.colors.ink3}
        maxLength={80}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.cta, (!valid || busy) && styles.disabled]}
        onPress={onSubmit}
        disabled={!valid || busy}
      >
        <Text style={styles.ctaText}>{busy ? 'Pairing…' : 'Pair'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24, gap: 12 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  body: { color: nativeTheme.colors.ink2, fontSize: 14, marginBottom: 8 },
  label: { color: nativeTheme.colors.ink3, fontSize: 12, marginTop: 8 },
  input: {
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: nativeTheme.colors.ink,
    fontSize: 14,
  },
  code: { fontVariant: ['tabular-nums'], letterSpacing: 1.5, fontSize: 16 },
  cta: {
    marginTop: 16,
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: { color: nativeTheme.colors.bg, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { color: nativeTheme.colors.bad, fontSize: 13 },
});
