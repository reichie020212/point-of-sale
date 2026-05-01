/**
 * Catalog / sell screen — placeholder. Real grid + cart integration
 * lands in M5.
 */
import { nativeTheme } from '@counter/tokens/native';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Money } from '../src/components/Money';
import { useCart } from '../src/state/cart';

export default function SellScreen() {
  const subtotal = useCart((s) => s.subtotalCents());
  const lineCount = useCart((s) => s.lines.length);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sell</Text>
      <Text style={styles.body}>
        Catalog grid lands in M5. For now, the cart subtotal proves the Money component renders
        prices in JetBrains Mono with tabular numerals.
      </Text>
      <View style={styles.cartCard}>
        <Text style={styles.cartLabel}>Cart subtotal ({lineCount} items)</Text>
        <Money cents={subtotal} style={styles.cartTotal} />
      </View>
      <Link href="/cart" asChild>
        <Pressable style={styles.next}>
          <Text style={styles.nextText}>Open cart</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24, gap: 16 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  body: { color: nativeTheme.colors.ink2, fontSize: 14, lineHeight: 20 },
  cartCard: {
    backgroundColor: nativeTheme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line,
  },
  cartLabel: { color: nativeTheme.colors.ink3, fontSize: 12 },
  cartTotal: { fontSize: 28, marginTop: 4 },
  next: {
    alignSelf: 'flex-start',
    backgroundColor: nativeTheme.colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextText: { color: nativeTheme.colors.bg, fontWeight: '500' },
});
