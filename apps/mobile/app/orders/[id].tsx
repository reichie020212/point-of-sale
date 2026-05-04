/**
 * Order detail screen.
 *
 * Reactive view of one order from the local Watermelon DB. Shows the
 * line items, payment summary, and the cumulative refunded amount so
 * the cashier can see at a glance how much of the order is still
 * refundable. The Refund button is disabled once the cumulative
 * refund total reaches the order's total — i.e. nothing left to refund.
 */
import {
  MockPrinter,
  type RefundReceipt,
  type RefundReceiptLine,
} from '@counter/printers';
import { nativeTheme } from '@counter/tokens/native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Money } from '../../src/components/Money';
import { PunchProgress } from '../../src/components/PunchProgress';
import { useOrderDetail, type OrderDetail, type RefundEntry } from '../../src/hooks/useOrderDetail';

// One shared instance is fine — the mock just logs, and the
// production BLE/Web instances are stateless beyond their device
// handle. When the W5 thermal printer lands, swap this for a hook
// that resolves the active printer from device state.
const printer = new MockPrinter();

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof params.id === 'string' ? params.id : undefined;
  const { detail, loading } = useOrderDetail(orderId);

  if (!orderId) {
    return (
      <View style={styles.container}>
        <Text style={styles.body}>Missing order id.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Order' }} />
        <ActivityIndicator color={nativeTheme.colors.ink} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Order' }} />
        <Text style={styles.body}>Order not found.</Text>
      </View>
    );
  }

  const remainingCents = Math.max(0, detail.totalCents - detail.refundedCents);
  const fullyRefunded = remainingCents <= 0;
  const time = new Date(detail.createdAtMs).toLocaleString();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Order' }} />

      <View style={styles.header}>
        <Text style={styles.heading}>Order</Text>
        <Text style={styles.subheading}>{time}</Text>
        <Text style={[styles.statusPill, statusPillTone(detail.status)]}>
          {prettyStatus(detail.status)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {detail.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemMeta}>
              <Text style={styles.itemName}>{item.nameSnapshot}</Text>
              <Text style={styles.itemQty}>× {item.qty}</Text>
            </View>
            <Money cents={item.subtotalCents} style={styles.itemPrice} />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Row label="Subtotal" value={<Money cents={detail.subtotalCents} />} />
        {detail.discountCents > 0 && (
          <Row label="Discount" value={<Money cents={-detail.discountCents} signed />} />
        )}
        <Row label="Tax" value={<Money cents={detail.taxCents} />} />
        {detail.tipCents > 0 && <Row label="Tip" value={<Money cents={detail.tipCents} />} />}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Money cents={detail.totalCents} style={styles.totalValue} />
        </View>
        {detail.refundedCents > 0 && (
          <View style={styles.refundedRow}>
            <Text style={styles.refundedLabel}>Refunded</Text>
            <Money cents={-detail.refundedCents} signed style={styles.refundedValue} />
          </View>
        )}
      </View>

      {detail.refunds.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Refund history</Text>
          {/* Newest-first so the most recent action sits at the top —
              the helper returns oldest-first to keep insertion order
              stable, so we reverse here at render time. */}
          {[...detail.refunds].reverse().map((r) => (
            <View key={r.id} style={styles.refundEntry}>
              <View style={styles.refundEntryHead}>
                <Text style={styles.refundEntryDate}>
                  {new Date(r.createdAtMs).toLocaleString()}
                </Text>
                <Money cents={r.amountCents} style={styles.refundEntryAmount} />
              </View>
              {(r.taxCents > 0 || r.tipCents > 0 || r.discountCents > 0) && (
                <Text style={styles.refundEntryBreakdown}>
                  Items <Money cents={r.subtotalCents} />
                  {r.taxCents > 0 && (
                    <>
                      {' · Tax '}
                      <Money cents={r.taxCents} />
                    </>
                  )}
                  {r.tipCents > 0 && (
                    <>
                      {' · Tip '}
                      <Money cents={r.tipCents} />
                    </>
                  )}
                  {r.discountCents > 0 && (
                    <>
                      {' · Discount −'}
                      <Money cents={r.discountCents} />
                    </>
                  )}
                </Text>
              )}
              {r.reason && <Text style={styles.refundEntryReason}>“{r.reason}”</Text>}
              <Pressable
                onPress={() => {
                  void printer.printRefund(...buildRefundReceipt(detail, r));
                }}
                style={styles.refundPrintBtn}
                accessibilityRole="button"
                accessibilityLabel="Print refund receipt"
              >
                <Text style={styles.refundPrintText}>Print receipt</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {detail.customerId && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loyalty</Text>
          <PunchProgress customerId={detail.customerId} />
        </View>
      )}

      <Link
        href={{ pathname: '/refund/[id]', params: { id: detail.id } }}
        asChild
      >
        <Pressable
          style={[styles.refundBtn, fullyRefunded && styles.disabled]}
          disabled={fullyRefunded}
          accessibilityRole="button"
          accessibilityLabel={fullyRefunded ? 'Order fully refunded' : 'Refund items'}
        >
          <Text style={styles.refundBtnText}>
            {fullyRefunded ? 'Fully refunded' : 'Refund items'}
          </Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

/**
 * Build the (refund, lines) tuple printRefund expects.
 *
 * `entry.lineQtys` is the authoritative `{ [orderItemId]: qty }` snapshot
 * persisted at refund time, so the printed itemization matches what the
 * cashier actually selected. Pre-v6 refund rows (no line_qtys_json
 * captured) have an empty map — we fall back to a greedy-subtotal match
 * against the order items so legacy refunds still produce a plausible
 * line list.
 */
function buildRefundReceipt(
  detail: OrderDetail,
  entry: RefundEntry,
): [RefundReceipt, RefundReceiptLine[]] {
  const refund: RefundReceipt = {
    id: entry.id,
    orderId: detail.id,
    createdAt: new Date(entry.createdAtMs).toISOString(),
    amountCents: entry.amountCents,
    subtotalCents: entry.subtotalCents,
    taxCents: entry.taxCents,
    tipCents: entry.tipCents,
    discountCents: entry.discountCents,
    originalTotalCents: detail.totalCents,
    reason: entry.reason,
    storeName: 'Counter',
    currency: 'PHP',
  };
  const lines: RefundReceiptLine[] = [];
  if (Object.keys(entry.lineQtys).length > 0) {
    for (const item of detail.items) {
      const qty = entry.lineQtys[item.id] ?? 0;
      if (qty <= 0) continue;
      const unit = item.qty > 0 ? Math.round(item.subtotalCents / item.qty) : item.unitPriceCents;
      lines.push({ nameSnapshot: item.nameSnapshot, qty, unitPriceCents: unit });
    }
  } else {
    // Legacy refund predating line_qtys_json — best-effort itemization.
    let remaining = entry.subtotalCents;
    for (const item of detail.items) {
      if (remaining <= 0) break;
      const unit = item.qty > 0 ? Math.round(item.subtotalCents / item.qty) : item.unitPriceCents;
      if (unit <= 0) continue;
      const fit = Math.min(item.qty, Math.floor(remaining / unit));
      if (fit <= 0) continue;
      lines.push({ nameSnapshot: item.nameSnapshot, qty: fit, unitPriceCents: unit });
      remaining -= fit * unit;
    }
  }
  return [refund, lines];
}

function prettyStatus(status: string): string {
  switch (status) {
    case 'paid':
    case 'completed':
      return 'Paid';
    case 'partially_refunded':
      return 'Partial refund';
    case 'refunded':
      return 'Refunded';
    default:
      return status;
  }
}

function statusPillTone(status: string) {
  if (status === 'refunded') return { color: nativeTheme.colors.bad };
  if (status === 'partially_refunded') return { color: nativeTheme.colors.warn };
  return { color: nativeTheme.colors.ink2 };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg },
  content: { padding: 24, gap: 16, paddingBottom: 48 },
  header: { gap: 4 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' as const },
  subheading: {
    color: nativeTheme.colors.ink2,
    fontSize: 14,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  statusPill: {
    alignSelf: 'flex-start' as const,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    overflow: 'hidden' as const,
  },
  body: { color: nativeTheme.colors.ink2, fontSize: 14 },
  card: {
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cardTitle: { color: nativeTheme.colors.ink2, fontSize: 12, textTransform: 'uppercase' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemMeta: { flex: 1, paddingRight: 12 },
  itemName: { color: nativeTheme.colors.ink, fontSize: 14, fontWeight: '500' },
  itemQty: { color: nativeTheme.colors.ink3, fontSize: 12, fontVariant: ['tabular-nums'] },
  itemPrice: { fontSize: 14 },
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
  refundedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  refundedLabel: { color: nativeTheme.colors.bad, fontSize: 14 },
  refundedValue: { color: nativeTheme.colors.bad, fontSize: 14 },
  refundEntry: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: nativeTheme.colors.line,
    gap: 4,
  },
  refundEntryHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refundEntryDate: {
    color: nativeTheme.colors.ink2,
    fontSize: 12,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  refundEntryAmount: { fontSize: 14, color: nativeTheme.colors.bad },
  refundEntryBreakdown: { color: nativeTheme.colors.ink3, fontSize: 11 },
  refundEntryReason: { color: nativeTheme.colors.ink2, fontSize: 12, fontStyle: 'italic' as const },
  refundPrintBtn: {
    alignSelf: 'flex-start' as const,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line2,
  },
  refundPrintText: { color: nativeTheme.colors.ink, fontSize: 12 },
  refundBtn: {
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 44,
  },
  refundBtnText: { color: nativeTheme.colors.bg, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
