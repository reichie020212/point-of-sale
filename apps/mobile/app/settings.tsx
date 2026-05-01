import { nativeTheme } from '@counter/tokens/native';
import { StyleSheet, Text, View } from 'react-native';

import { useSyncStatus } from '../src/state/sync-status';

export default function SettingsScreen() {
  const status = useSyncStatus((s) => s.status);
  const lastPullAt = useSyncStatus((s) => s.lastPullAt);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Sync status</Text>
        <Text style={styles.value}>{status}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Last pull</Text>
        <Text style={styles.value}>
          {lastPullAt ? new Date(lastPullAt).toLocaleString() : 'never'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: nativeTheme.colors.line,
  },
  label: { color: nativeTheme.colors.ink2, fontSize: 14 },
  value: { color: nativeTheme.colors.ink, fontSize: 14, fontVariant: ['tabular-nums'] },
});
