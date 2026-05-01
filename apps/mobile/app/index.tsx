/**
 * PIN sign-in. The first screen a barista sees in the morning.
 *
 * Real PIN flow + Face/Touch ID after first PIN lands in M5; M4 just
 * scaffolds the layout and routes forward to /sell on submit.
 */
import { nativeTheme } from '@counter/tokens/native';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function PinSignIn() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Counter</Text>
      <Text style={styles.title}>Enter PIN</Text>
      <View style={styles.pinRow}>
        {[1, 2, 3, 4].map((slot) => (
          <View key={slot} style={styles.pinDot} />
        ))}
      </View>
      <Link href="/sell" asChild>
        <Pressable style={styles.continue}>
          <Text style={styles.continueText}>Continue (placeholder)</Text>
        </Pressable>
      </Link>
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
    gap: 24,
  },
  brand: { color: nativeTheme.colors.ink, fontSize: 28, fontWeight: '600' },
  title: { color: nativeTheme.colors.ink2, fontSize: 16 },
  pinRow: { flexDirection: 'row', gap: 12 },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line2,
  },
  continue: {
    backgroundColor: nativeTheme.colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  continueText: { color: nativeTheme.colors.bg, fontWeight: '500' },
});
