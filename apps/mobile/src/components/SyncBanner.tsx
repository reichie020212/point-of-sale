/**
 * SyncBanner — chrome-level notice when the sync engine is in a
 * non-live state. Shows a `tier_required` upgrade nag for free orgs
 * (per master Blueprint §8 step 12), and a quieter offline indicator
 * otherwise.
 *
 * Local sells never block on sync — the banner is purely informational.
 */
import { nativeTheme } from '@counter/tokens/native';
import { StyleSheet, Text, View } from 'react-native';

import { useSyncStatus } from '../state/sync-status';

export function SyncBanner() {
  const status = useSyncStatus((s) => s.status);
  if (status === 'live' || status === 'syncing') return null;

  const isDisabled = status === 'disabled';
  const message = isDisabled
    ? 'Sync paused — upgrade to Pro to sync registers.'
    : status === 'connecting'
      ? 'Connecting to sync…'
      : 'Working offline. Sales will sync when you reconnect.';

  return (
    <View style={[styles.banner, isDisabled ? styles.warn : styles.muted]}>
      <Text style={[styles.text, isDisabled ? styles.warnText : styles.mutedText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: nativeTheme.spacing[4],
    paddingVertical: nativeTheme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: nativeTheme.colors.line,
  },
  muted: { backgroundColor: nativeTheme.colors.surface2 },
  warn: { backgroundColor: nativeTheme.colors.accentSoft },
  text: { fontSize: 13, textAlign: 'center' },
  mutedText: { color: nativeTheme.colors.ink3 },
  warnText: { color: nativeTheme.colors.accentDeep, fontWeight: '500' },
});
