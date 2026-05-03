/**
 * Order detail screen.
 *
 * Reactive view of one order from the local Watermelon DB. Shows the
 * line items, payment summary, and the cumulative refunded amount so
 * the cashier can see at a glance how much of the order is still
 * refundable. The Refund button is disabled once the cumulative
 * refund total reaches the order's total — i.e. nothing left to refund.
 */
import { nativeTheme } from '@counter/tokens/native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Money } from '../../src/components/Money';
import { PunchProgress } from '../../src/components/PunchProgress';
import { useOrderDetail } from '../../src/hooks/useOrderDetail';

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
