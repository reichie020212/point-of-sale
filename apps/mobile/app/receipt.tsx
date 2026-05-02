/**
 * Receipt screen — shows the formatted receipt for the just-finalised
 * sale. "Print" uses the MockPrinter on mobile; the real BLE thermal
 * printer wires in once we have a paired device (W5 field work).
 */
import { MockPrinter, formatReceiptText } from '@counter/printers';
import { nativeTheme } from '@counter/tokens/native';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLastSale } from '../src/state/last-sale';

const printer = new MockPrinter();

export default function ReceiptScreen() {
  const sale = useLastSale((s) => s.sale);
  const clear = useLastSale((s) => s.clear);

  if (!sale) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No recent sale.</Text>
        <Link href="/sell" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Back to sell</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const text = formatReceiptText(sale.order, sale.items);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sale complete</Text>
      <ScrollView style={styles.receiptWrap} contentContainerStyle={styles.receiptInner}>
        <Text style={styles.receiptText}>{text}</Text>
      </ScrollView>
      <View style={styles.actions}>
        <Pressable
          style={styles.printButton}
          onPress={() => {
            void printer.print(sale.order, sale.items);
          }}
        >
          <Text style={styles.printText}>Print (mock)</Text>
        </Pressable>
        <Link href="/sell" asChild>
          <Pressable
            style={styles.newButton}
            onPress={() => {
              clear();
            }}
          >
            <Text style={styles.newText}>New sale</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24, gap: 16 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  receiptWrap: {
    flex: 1,
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
  },
  receiptInner: { padding: 16 },
  receiptText: {
    fontFamily: nativeTheme.fonts.mono,
    fontSize: 12,
    color: nativeTheme.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  actions: { flexDirection: 'row', gap: 8 },
  printButton: {
    flex: 1,
    backgroundColor: nativeTheme.colors.surface,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  printText: { color: nativeTheme.colors.ink, fontSize: 14, fontWeight: '500' },
  newButton: {
    flex: 1,
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  newText: { color: nativeTheme.colors.bg, fontSize: 14, fontWeight: '600' },
  empty: {
    flex: 1,
    backgroundColor: nativeTheme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: { color: nativeTheme.colors.ink2 },
  button: {
    backgroundColor: nativeTheme.colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: nativeTheme.colors.bg, fontWeight: '500' },
});
