/**
 * Settings.
 *
 * Surfaces the sync status (live/offline/last-pull) and the paired
 * device identity. From here the operator can re-pair (which clears
 * the local token and pushes them to /pair).
 */
import { nativeTheme } from '@counter/tokens/native';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clearDeviceToken } from '../src/api/client';
import { useDevice } from '../src/state/device';
import { useSyncStatus } from '../src/state/sync-status';

export default function SettingsScreen() {
  const status = useSyncStatus((s) => s.status);
  const lastPullAt = useSyncStatus((s) => s.lastPullAt);
  const identity = useDevice((s) => s.identity);
  const setIdentity = useDevice((s) => s.set);

  const onUnpair = async () => {
    await clearDeviceToken();
    setIdentity(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>

      <Section title="Device">
        {identity ? (
          <>
            <Row label="Name" value={identity.deviceName} />
            <Row label="Device ID" value={identity.deviceId.slice(0, 8) + '…'} mono />
            <Pressable style={styles.unpair} onPress={onUnpair}>
              <Text style={styles.unpairText}>Unpair this device</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.body}>This device is not yet paired.</Text>
            <Link href="/pair" asChild>
              <Pressable style={styles.cta}>
                <Text style={styles.ctaText}>Pair device</Text>
              </Pressable>
            </Link>
          </>
        )}
      </Section>

      <Section title="Sync">
        <Row label="Status" value={status} />
        <Row
          label="Last pull"
          value={lastPullAt ? new Date(lastPullAt).toLocaleString() : 'never'}
          mono
        />
      </Section>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24, gap: 24 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  section: {
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  sectionTitle: { color: nativeTheme.colors.ink3, fontSize: 11, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: { color: nativeTheme.colors.ink2, fontSize: 14 },
  value: { color: nativeTheme.colors.ink, fontSize: 14 },
  mono: { fontVariant: ['tabular-nums'] },
  body: { color: nativeTheme.colors.ink2, fontSize: 14 },
  cta: {
    marginTop: 12,
    backgroundColor: nativeTheme.colors.ink,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: { color: nativeTheme.colors.bg, fontSize: 14, fontWeight: '600' },
  unpair: {
    marginTop: 12,
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.bad,
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  unpairText: { color: nativeTheme.colors.bad, fontSize: 13, fontWeight: '500' },
});
