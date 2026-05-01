/**
 * Payment screen — cash flow.
 *
 * On Cash press:
 *   1. Generate a stable clientOpId (also used by the future sync
 *      queue for idempotency).
 *   2. CashProvider.charge() — synchronous success.
 *   3. Build a ReceiptOrder + ReceiptItem[] from the cart.
 *   4. Store it in the lastSale Zustand slice for the receipt screen.
 *   5. Enqueue an order op for sync. Today this is the in-memory queue
 *      stub from M6; once Watermelon model classes land it becomes a
 *      durable write.
 *   6. Clear the cart and navigate to /receipt.
 *
 * Card / split / Stripe Terminal flow lands when StripeTerminalProvider
 * gets its real implementation in W5.
 */
import { CashProvider } from '@counter/payments';
import { nativeTheme } from '@counter/tokens/native';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Money } from '../src/components/Money';
import { useCart } from '../src/state/cart';
import { useLastSale } from '../src/state/last-sale';
import { enqueue } from '../src/sync/queue';

import type { ReceiptItem, ReceiptOrder } from '@counter/printers';

const cash = new CashProvider();

export default function PaymentScreen() {
  const lines = useCart((s) => s.lines);
  const subtotal = useCart((s) => s.subtotalCents());
  const tipCents = useCart((s) => s.tipCents);
  const discountCents = useCart((s) => s.discountCents);
  const customerId = useCart((s) => s.customerId);
  const clear = useCart((s) => s.clear);
  const setLastSale = useLastSale((s) => s.set);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // TODO(policy-tax): pull the configured tax rate from the org. Default
  // 8.25% US per master Blueprint §6 — a placeholder until the rate is
  // sourced from the active org.
  const taxCents = Math.round((subtotal - discountCents) * 0.0825);
  const totalCents = subtotal - discountCents + taxCents + tipCents;

  const onCash = async () => {
    if (lines.length === 0) return;
    setBusy(true);
    setError(null);
    const clientOpId = `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const charge = await cash.charge({
        amountCents: totalCents,
        currency: 'USD',
        clientOpId,
      });
      if (!charge.ok) {
        setError(charge.errorMessage ?? 'charge failed');
        return;
      }
      const orderId = clientOpId;
      const order: ReceiptOrder = {
        id: orderId,
        createdAt: new Date().toISOString(),
        totalCents,
        subtotalCents: subtotal,
        taxCents,
        tipCents,
        paymentMethod: 'cash',
        storeName: 'Counter',
      };
      const items: ReceiptItem[] = lines.map((l) => ({
        nameSnapshot: l.nameSnapshot,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        modifiersSummary:
          l.modifiers.length > 0 ? l.modifiers.map((m) => m.name).join(', ') : undefined,
      }));
      setLastSale({ order, items });

      // Enqueue an order push for sync. The current queue is the M6
      // in-memory stub; durable persistence lands with Watermelon
      // model classes.
      await enqueue({
        clientOpId,
        table: 'orders',
        payload: {
          id: orderId,
          customerId,
          paymentMethod: 'cash',
          subtotalCents: subtotal,
          taxCents,
          tipCents,
          discountCents,
          totalCents,
          paymentReference: charge.transactionId,
          clientOpId,
        },
        asDelta: false,
      });

      clear();
      router.replace('/receipt');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Payment</Text>

      <View style={styles.summary}>
        <Row label="Subtotal" value={<Money cents={subtotal} />} />
        {discountCents > 0 && (
          <Row label="Discount" value={<Money cents={-discountCents} signed />} />
        )}
        <Row label="Tax" value={<Money cents={taxCents} />} />
        {tipCents > 0 && <Row label="Tip" value={<Money cents={tipCents} />} />}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Money cents={totalCents} style={styles.totalValue} />
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.cash, busy && styles.disabled]} onPress={onCash} disabled={busy}>
        <Text style={styles.cashText}>{busy ? 'Charging…' : 'Cash'}</Text>
      </Pressable>
      <Pressable style={[styles.card, styles.disabled]} disabled>
        <Text style={styles.cardText}>Card (Stripe Terminal — W5)</Text>
      </Pressable>
    </View>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24, gap: 16 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  summary: {
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: nativeTheme.colors.ink2, fontSize: 14 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: nativeTheme.colors.line,
  },
  totalLabel: { color: nativeTheme.colors.ink, fontSize: 16, fontWeight: '600' },
  totalValue: { fontSize: 22 },
  error: { color: nativeTheme.colors.bad, fontSize: 14 },
  cash: {
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cashText: { color: nativeTheme.colors.bg, fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line2,
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cardText: { color: nativeTheme.colors.ink3, fontSize: 14 },
  disabled: { opacity: 0.5 },
});
