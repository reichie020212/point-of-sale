/**
 * Payment screen — placeholder. M9 wires the CashProvider here.
 */
import { nativeTheme } from '@counter/tokens/native';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Money } from '../src/components/Money';
import { useCart } from '../src/state/cart';

export default function PaymentScreen() {
  const subtotal = useCart((s) => s.subtotalCents());
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Payment</Text>
      <Money cents={subtotal} style={styles.total} />
      <Link href="/receipt" asChild>
        <Pressable style={styles.cashButton}>
          <Text style={styles.cashText}>Cash (placeholder)</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24, gap: 16 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  total: { fontSize: 36 },
  cashButton: {
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cashText: { color: nativeTheme.colors.bg, fontSize: 16, fontWeight: '600' },
});
