/**
 * Refund flow.
 *
 * Itemized selection per the §9 locked decision (partial refunds, reason
 * required). Three things happen on submit, in one local transaction:
 *
 *   1. A `refunds` row is created locally with the refund total.
 *   2. One `inventory_movements` row per refunded line is created with
 *      a positive delta (restock).
 *   3. The order's status flips to `partially_refunded` (or `refunded`
 *      if everything is being returned).
 *
 * Each of those writes is also enqueued for the server with the same
 * clientOpIds. The server's transactional PUSH applies them atomically
 * — if the network drops mid-PUSH, the server-side `sync_idempotency`
 * table dedupes on retry; if the device dies, `sync_queue` survives the
 * crash and the next boot drains it.
 *
 * The local order status flip happens *before* the server confirms; if
 * the server somehow rejects the refund (it shouldn't — there's no
 * server-side validation that can fail offline-first inputs once the
 * row exists), the next PULL would overwrite us with the canonical
 * status.
 */
import { nativeTheme } from '@counter/tokens/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Money } from '../../src/components/Money';
import { database } from '../../src/db';
import { useOrderDetail } from '../../src/hooks/useOrderDetail';
import { track } from '../../src/observability/funnel';
import { useAuth } from '../../src/state/auth';
import { useDevice } from '../../src/state/device';
import {
  clampQty,
  computeRefundBreakdown,
  selectAll as buildSelectAll,
  validateRefund,
  type RefundableLine,
  type RefundSelection,
} from '../../src/state/refund-helpers';
import { enqueue } from '../../src/sync/queue';

export default function RefundScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof params.id === 'string' ? params.id : undefined;
  const { detail, loading } = useOrderDetail(orderId);
  const identity = useDevice((s) => s.identity);
  const activeUser = useAuth((s) => s.activeUser);

  const [selection, setSelection] = useState<RefundSelection>({ qtyById: {} });

  // Funnel signal: the cashier opened the refund flow for an order.
  // Fires once per screen mount; opening the same order twice fires
  // twice, which is the right resolution for funnel analysis.
  useEffect(() => {
    if (orderId) track('refund_started', { orderId });
  }, [orderId]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lines = useMemo<RefundableLine[]>(() => {
    if (!detail) return [];
    return detail.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      nameSnapshot: item.nameSnapshot,
      originalQty: item.qty,
      // Use line subtotal / qty so modifier-bumped per-unit price stays
      // honest. Falls back to unitPriceCents if qty somehow rounds bad.
      unitPriceCents: item.qty > 0 ? Math.round(item.subtotalCents / item.qty) : item.unitPriceCents,
    }));
  }, [detail]);

  const breakdown = useMemo(() => {
    if (!detail) return null;
    return computeRefundBreakdown(
      {
        subtotalCents: detail.subtotalCents,
        taxCents: detail.taxCents,
        tipCents: detail.tipCents,
        discountCents: detail.discountCents,
      },
      lines,
      selection,
      detail.priorRefunds,
    );
  }, [detail, lines, selection]);

  const refundCents = breakdown?.amountCents ?? 0;

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
        <Stack.Screen options={{ title: 'Refund' }} />
        <ActivityIndicator color={nativeTheme.colors.ink} />
      </View>
    );
  }
  if (!detail) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Refund' }} />
        <Text style={styles.body}>Order not found.</Text>
      </View>
    );
  }

  const updateLine = (lineId: string, delta: number, max: number) => {
    setSelection((prev) => {
      const current = prev.qtyById[lineId] ?? 0;
      const next = clampQty(current + delta, max);
      return { qtyById: { ...prev.qtyById, [lineId]: next } };
    });
  };

  const onSelectAll = () => setSelection(buildSelectAll(lines));
  const onClear = () => setSelection({ qtyById: {} });

  const onSubmit = async () => {
    setError(null);
    const v = validateRefund(lines, selection, reason);
    if (!v.ok) {
      setError(v.reason ?? 'Invalid refund');
      return;
    }
    if (!breakdown) {
      setError('Refund breakdown unavailable');
      return;
    }
    setBusy(true);
    try {
      const refundClientOpId = makeOpId('refund');
      const orgId = identity?.orgId ?? '';
      const deviceId = identity?.deviceId ?? '';
      // Closing-out is the source-of-truth for status: a single full
      // refund OR the last of multiple partials both flip the order
      // to `refunded`. The server recomputes from cumulative refund
      // sums, so this is just the optimistic local guess.
      const newStatus = breakdown.closesOut ? 'refunded' : 'partially_refunded';

      // Build per-line restock movements first so we can write them
      // and enqueue them with stable ids.
      const restocks = lines
        .map((line) => {
          const qty = selection.qtyById[line.id] ?? 0;
          if (qty <= 0) return null;
          return {
            clientOpId: makeOpId('inv'),
            id: makeUuidLike(),
            variantId: line.variantId,
            delta: qty,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const refundId = makeUuidLike();

      await database.write(async () => {
        const refundsCol = database.get('refunds');
        const movementsCol = database.get('inventory_movements');
        const ordersCol = database.get('orders');

        await refundsCol.create((row) => {
          const raw = (row as unknown as { _raw: Record<string, unknown> })._raw;
          raw.server_id = refundId;
          raw.client_op_id = refundClientOpId;
          raw.org_id = orgId;
          raw.order_id = detail.id;
          raw.amount_cents = breakdown.amountCents;
          raw.subtotal_cents = breakdown.subtotalCents;
          raw.tax_cents = breakdown.taxCents;
          raw.tip_cents = breakdown.tipCents;
          raw.discount_cents = breakdown.discountCents;
          raw.reason = reason.trim();
          raw.processed_by_id = activeUser?.id ?? null;
          raw.payment_reference = null;
          raw.created_at = Date.now();
        });

        for (const r of restocks) {
          await movementsCol.create((row) => {
            const raw = (row as unknown as { _raw: Record<string, unknown> })._raw;
            raw.server_id = r.id;
            raw.client_op_id = r.clientOpId;
            raw.org_id = orgId;
            raw.variant_id = r.variantId;
            raw.delta = r.delta;
            raw.reason = 'refund';
            raw.device_id = deviceId;
            raw.created_at = Date.now();
          });
        }

        // Optimistic order status flip — server recomputes from
        // cumulative refund total inside the writer, and the EVENT
        // overwrites our local guess if it differs.
        const found = await ordersCol.query().fetch();
        const target = found.find(
          (o) => (o as unknown as { _raw: { server_id: string } })._raw.server_id === detail.id,
        );
        if (target) {
          await target.update((row) => {
            const raw = (row as unknown as { _raw: Record<string, unknown> })._raw;
            raw.status = newStatus;
          });
        }
      });

      // Enqueue server PUSH ops. The refund row is processed first by
      // the server (the transaction is single-batch but ordered) so the
      // order status is current before the inventory restocks land.
      await enqueue({
        clientOpId: refundClientOpId,
        table: 'refunds',
        payload: {
          id: refundId,
          orderId: detail.id,
          amountCents: breakdown.amountCents,
          subtotalCents: breakdown.subtotalCents,
          taxCents: breakdown.taxCents,
          tipCents: breakdown.tipCents,
          discountCents: breakdown.discountCents,
          reason: reason.trim(),
          processedById: activeUser?.id ?? null,
          clientOpId: refundClientOpId,
        },
        asDelta: false,
      });
      for (const r of restocks) {
        await enqueue({
          clientOpId: r.clientOpId,
          table: 'inventory_movements',
          payload: {
            id: r.id,
            variantId: r.variantId,
            delta: r.delta,
            reason: 'refund',
            deviceId,
            clientOpId: r.clientOpId,
          },
          asDelta: true,
        });
      }

      router.replace({ pathname: '/orders/[id]', params: { id: detail.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setBusy(false);
    }
  };

  const remainingCents = Math.max(0, detail.totalCents - detail.refundedCents);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Refund' }} />
      <Text style={styles.heading}>Refund items</Text>
      <Text style={styles.subheading}>
        Refundable: <Money cents={remainingCents} /> of <Money cents={detail.totalCents} />
      </Text>

      <View style={styles.card}>
        <View style={styles.itemsHeader}>
          <Text style={styles.cardTitle}>Items</Text>
          <View style={styles.itemsHeaderActions}>
            <Pressable
              onPress={onSelectAll}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Select all items"
            >
              <Text style={styles.headerBtnText}>Select all</Text>
            </Pressable>
            <Pressable
              onPress={onClear}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear selection"
            >
              <Text style={styles.headerBtnText}>Clear</Text>
            </Pressable>
          </View>
        </View>
        {lines.map((line) => {
          const qty = selection.qtyById[line.id] ?? 0;
          return (
            <View key={line.id} style={styles.lineRow}>
              <View style={styles.lineMeta}>
                <Text style={styles.lineName}>{line.nameSnapshot}</Text>
                <Text style={styles.lineHint}>
                  Up to {line.originalQty} · <Money cents={line.unitPriceCents} /> ea
                </Text>
              </View>
              <View style={styles.qtyBlock}>
                <Pressable
                  onPress={() => updateLine(line.id, -1, line.originalQty)}
                  style={[styles.stepBtn, qty <= 0 && styles.stepBtnDisabled]}
                  disabled={qty <= 0}
                  accessibilityLabel={`Decrease ${line.nameSnapshot}`}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{qty}</Text>
                <Pressable
                  onPress={() => updateLine(line.id, 1, line.originalQty)}
                  style={[styles.stepBtn, qty >= line.originalQty && styles.stepBtnDisabled]}
                  disabled={qty >= line.originalQty}
                  accessibilityLabel={`Increase ${line.nameSnapshot}`}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reason (required)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Customer changed mind"
          placeholderTextColor={nativeTheme.colors.ink3}
          style={styles.reasonInput}
          multiline
        />
      </View>

      {breakdown && (
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Refund summary</Text>
          <BreakdownRow label="Items" value={breakdown.subtotalCents} />
          {detail.discountCents > 0 && (
            <BreakdownRow
              label="Discount reversed"
              value={breakdown.discountCents}
              negative
            />
          )}
          {detail.taxCents > 0 && (
            <BreakdownRow label="Tax returned" value={breakdown.taxCents} />
          )}
          {detail.tipCents > 0 && (
            <BreakdownRow
              label="Tip"
              value={breakdown.tipCents}
              hint={breakdown.closesOut ? undefined : 'Held — only refunds on full return'}
            />
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total refund</Text>
            <Money cents={refundCents} style={styles.totalValue} />
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.submit, busy && styles.disabled]}
        onPress={() => {
          void onSubmit();
        }}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.submitText}>
          {busy ? 'Processing…' : breakdown?.closesOut ? 'Refund full order' : 'Refund selected'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function BreakdownRow({
  label,
  value,
  hint,
  negative,
}: {
  label: string;
  value: number;
  hint?: string;
  negative?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        {hint && <Text style={styles.summaryHint}>{hint}</Text>}
      </View>
      <Text style={styles.summaryValue}>
        {negative ? '−' : ''}
        <Money cents={value} />
      </Text>
    </View>
  );
}

function makeOpId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// RFC4122-ish v4 UUID. The server treats any string-shaped UUID id as
// canonical, so we don't need crypto-grade randomness — just unique
// enough that two devices never collide. Math.random across a 32-hex
// alphabet keeps collision risk negligible per device-day.
function makeUuidLike(): string {
  const hex = (n: number) =>
    Math.floor(Math.random() * 16 ** n)
      .toString(16)
      .padStart(n, '0');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg },
  content: { padding: 24, gap: 16, paddingBottom: 48 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' as const },
  subheading: { color: nativeTheme.colors.ink2, fontSize: 14 },
  body: { color: nativeTheme.colors.ink2, fontSize: 14, padding: 24 },
  card: {
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: nativeTheme.colors.ink2, fontSize: 12, textTransform: 'uppercase' as const },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineMeta: { flex: 1, paddingRight: 12 },
  lineName: { color: nativeTheme.colors.ink, fontSize: 14, fontWeight: '500' as const },
  lineHint: { color: nativeTheme.colors.ink3, fontSize: 12 },
  qtyBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line2,
    backgroundColor: nativeTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnText: { color: nativeTheme.colors.ink, fontSize: 18, fontWeight: '600' as const },
  qtyValue: {
    minWidth: 28,
    textAlign: 'center' as const,
    color: nativeTheme.colors.ink,
    fontSize: 16,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  reasonInput: {
    minHeight: 64,
    color: nativeTheme.colors.ink,
    fontSize: 14,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line2,
    backgroundColor: nativeTheme.colors.bg,
    textAlignVertical: 'top' as const,
  },
  summaryCard: {
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: { color: nativeTheme.colors.ink2, fontSize: 14 },
  summaryHint: { color: nativeTheme.colors.ink3, fontSize: 11, marginTop: 2 },
  summaryValue: { color: nativeTheme.colors.ink, fontSize: 14 },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: nativeTheme.colors.line,
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { color: nativeTheme.colors.ink, fontSize: 16, fontWeight: '600' as const },
  totalValue: { fontSize: 22 },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemsHeaderActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line2,
  },
  headerBtnText: { color: nativeTheme.colors.ink, fontSize: 12 },
  error: { color: nativeTheme.colors.bad, fontSize: 14 },
  submit: {
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 44,
  },
  submitText: { color: nativeTheme.colors.bg, fontSize: 16, fontWeight: '600' as const },
  disabled: { opacity: 0.5 },
});
