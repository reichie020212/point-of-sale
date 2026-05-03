/**
 * Pair this device.
 *
 * Two entry paths share one shared completion lane:
 *   1. Camera scan of the 12-char QR rendered on the web Pair-Device modal.
 *   2. Manual CNTR-XXXX-XXXX entry (kept as a fallback for accessibility,
 *      denied permissions, and broken cameras).
 *
 * Successful pair persists the opaque dvc_<…> token via expo-secure-store
 * (setDeviceToken), caches identity in the in-memory zustand slice so
 * settings can show it, and bounces back to /sell.
 */
import { nativeTheme } from '@counter/tokens/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, apiCalls, setDeviceToken } from '../src/api/client';
import { track } from '../src/observability/funnel';
import { useDevice } from '../src/state/device';

const CODE_REGEX = /^CNTR-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

type Mode = 'idle' | 'scanning' | 'manual';

export default function PairScreen() {
  const setIdentity = useDevice((s) => s.set);
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('idle');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Block re-entrant onBarcodeScanned firings between scan + pair RTT.
  const handlingScan = useRef(false);

  const trimmed = code.trim().toUpperCase();
  const validManual = CODE_REGEX.test(trimmed);

  const completePair = async (rawCode: string, deviceName?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiCalls.pair({
        code: rawCode,
        name: deviceName && deviceName.length > 0 ? deviceName : undefined,
      });
      await setDeviceToken(res.token);
      setIdentity({
        deviceId: res.device.id,
        deviceName: res.device.name,
        orgId: res.device.orgId,
      });
      track('device_paired', { orgId: res.device.orgId });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else setError(err instanceof Error ? err.message : 'pair failed');
      handlingScan.current = false;
    } finally {
      setBusy(false);
    }
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (handlingScan.current) return;
    const candidate = data.trim().toUpperCase();
    if (!CODE_REGEX.test(candidate)) {
      // Ignore stray QRs in the field of view.
      return;
    }
    handlingScan.current = true;
    void Haptics.selectionAsync();
    void completePair(candidate, name.trim());
  };

  const startScan = async () => {
    setError(null);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setMode('manual');
        setError('Camera permission denied — enter the code by hand.');
        return;
      }
    }
    handlingScan.current = false;
    setMode('scanning');
  };

  if (mode === 'scanning' && permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Scan pairing code</Text>
        <Text style={styles.body}>
          Hold the phone up to the QR shown on the dashboard&apos;s Registers page.
        </Text>
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={busy ? undefined : onBarcode}
          />
          <View pointerEvents="none" style={styles.reticle} />
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.secondaryCta} onPress={() => setMode('manual')}>
          <Text style={styles.secondaryText}>Enter code by hand instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Pair this device</Text>
      <Text style={styles.body}>
        On a paired computer, open the dashboard, go to Registers → Pair new device, then
        scan the QR or type the 12 characters below.
      </Text>

      {permission?.canAskAgain !== false && (
        <Pressable style={styles.cta} onPress={startScan}>
          <Text style={styles.ctaText}>Scan QR code</Text>
        </Pressable>
      )}

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
        style={[styles.cta, (!validManual || busy) && styles.disabled]}
        onPress={() => completePair(trimmed, name.trim())}
        disabled={!validManual || busy}
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
  secondaryCta: { padding: 12, alignItems: 'center' },
  secondaryText: { color: nativeTheme.colors.ink2, fontSize: 14, textDecorationLine: 'underline' },
  disabled: { opacity: 0.5 },
  error: { color: nativeTheme.colors.bad, fontSize: 13 },
  cameraWrap: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: nativeTheme.colors.ink,
  },
  camera: { flex: 1 },
  reticle: {
    position: 'absolute',
    top: '15%',
    bottom: '15%',
    left: '15%',
    right: '15%',
    borderWidth: 2,
    borderColor: nativeTheme.colors.bg,
    borderRadius: 12,
  },
});
