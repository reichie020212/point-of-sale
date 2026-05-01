import { nativeTheme } from '@counter/tokens/native';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Money } from '../src/components/Money';
import { useCart } from '../src/state/cart';

/** Cart screen. Full swipe-to-remove + qty stepper lands in M5. */
export default function CartScreen() {
  const lines = useCart((s) => s.lines);
  const subtotal = useCart((s) => s.subtotalCents());

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Cart</Text>
      {lines.length === 0 ? (
        <Text style={styles.empty}>Empty cart. Tap a product on the Sell screen to add.</Text>
      ) : (
        lines.map((line) => (
          <View key={line.lineId} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{line.nameSnapshot}</Text>
              <Text style={styles.lineQty}>×{line.qty}</Text>
            </View>
            <Money cents={line.qty * line.unitPriceCents} />
          </View>
        ))
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Subtotal</Text>
        <Money cents={subtotal} style={styles.totalAmount} />
      </View>
      <Pressable
        disabled={lines.length === 0}
        style={[styles.checkout, lines.length === 0 && styles.disabled]}
        onPress={() => router.push('/payment')}
      >
        <Text style={styles.checkoutText}>Charge</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24, gap: 12 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  empty: { color: nativeTheme.colors.ink3, fontSize: 14 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: nativeTheme.colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line,
  },
  lineName: { color: nativeTheme.colors.ink, fontSize: 14 },
  lineQty: { color: nativeTheme.colors.ink3, fontSize: 12 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: nativeTheme.colors.line,
  },
  totalLabel: { color: nativeTheme.colors.ink2, fontSize: 14 },
  totalAmount: { fontSize: 22 },
  checkout: {
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: { opacity: 0.4 },
  checkoutText: { color: nativeTheme.colors.bg, fontSize: 16, fontWeight: '600' },
});
