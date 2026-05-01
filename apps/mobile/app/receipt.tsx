import { nativeTheme } from '@counter/tokens/native';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCart } from '../src/state/cart';

export default function ReceiptScreen() {
  const clear = useCart((s) => s.clear);
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sale complete</Text>
      <Text style={styles.body}>Thermal printer preview + SMS / Email send land in M9.</Text>
      <Link href="/sell" asChild>
        <Pressable style={styles.button} onPress={() => clear()}>
          <Text style={styles.buttonText}>New sale</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24, gap: 16 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  body: { color: nativeTheme.colors.ink2, fontSize: 14 },
  button: {
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: nativeTheme.colors.bg, fontSize: 16, fontWeight: '600' },
});
