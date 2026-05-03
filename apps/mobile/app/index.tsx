/**
 * PIN sign-in. The first screen a cashier sees in the morning.
 *
 * Verification is local — `users` is sync-replicated to the device, so
 * the PIN check works offline (HANDOFF non-negotiable: never block a
 * sell action on the network). On success we set the active user via
 * `useAuth` and route to /sell. On failure we shake the entry row and
 * clear the buffer.
 *
 * No biometrics yet; that arrives once the team has actual PINs in
 * the field. Face/Touch ID lands as a follow-up.
 */
import { nativeTheme } from '@counter/tokens/native';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/state/auth';

const PIN_LENGTH = 4;

const KEY_ROWS: Array<Array<string | null>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'del'],
];

export default function PinSignIn() {
  const signIn = useAuth((s) => s.signIn);
  const activeUser = useAuth((s) => s.activeUser);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  // If we're already signed in (e.g. from an earlier nav), short-circuit
  // straight to /sell. The session is in-memory only, so this only
  // matters during a same-launch back-to-pin navigation.
  useEffect(() => {
    if (activeUser) router.replace('/sell');
  }, [activeUser]);

  function press(value: string) {
    if (busy) return;
    setError(null);
    if (value === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + value));
  }

  // Submit when the buffer fills. useEffect avoids racing the setState.
  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    let cancelled = false;
    setBusy(true);
    void signIn(pin).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        router.replace('/sell');
        return;
      }
      // Shake + clear, leave a hint.
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 8,
          duration: 60,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
        Animated.timing(shake, {
          toValue: -8,
          duration: 60,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
      ]).start();
      setError(result.reason === 'invalid-pin' ? 'PIN must be 4 digits.' : 'Incorrect PIN.');
      setPin('');
      setBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pin, signIn, shake]);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Counter</Text>
      <Text style={styles.title}>Enter PIN</Text>
      <Animated.View style={[styles.pinRow, { transform: [{ translateX: shake }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
        ))}
      </Animated.View>
      <Text style={styles.error} accessibilityLiveRegion="polite">
        {error ?? ''}
      </Text>
      <View style={styles.keypad}>
        {KEY_ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.keyRow}>
            {row.map((key, keyIdx) => {
              if (key === null) {
                return <View key={keyIdx} style={styles.keyPlaceholder} />;
              }
              return (
                <Pressable
                  key={keyIdx}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                  onPress={() => press(key)}
                  accessibilityRole="button"
                  accessibilityLabel={key === 'del' ? 'Delete' : `Digit ${key}`}
                >
                  <Text style={styles.keyLabel}>{key === 'del' ? '⌫' : key}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: nativeTheme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 18,
  },
  brand: {
    color: nativeTheme.colors.ink,
    fontSize: 28,
    fontFamily: nativeTheme.fonts.display,
  },
  title: { color: nativeTheme.colors.ink2, fontSize: 16 },
  pinRow: { flexDirection: 'row', gap: 14 },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: nativeTheme.colors.line2,
    backgroundColor: nativeTheme.colors.bg,
  },
  pinDotFilled: { backgroundColor: nativeTheme.colors.ink, borderColor: nativeTheme.colors.ink },
  error: { color: nativeTheme.colors.bad, fontSize: 13, minHeight: 18 },
  keypad: { gap: 10, marginTop: 8 },
  keyRow: { flexDirection: 'row', gap: 10 },
  key: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: nativeTheme.colors.surface,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: nativeTheme.colors.surface2 },
  keyLabel: {
    color: nativeTheme.colors.ink,
    fontSize: 24,
    fontFamily: nativeTheme.fonts.uiMedium,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  keyPlaceholder: { width: 72, height: 72 },
});
