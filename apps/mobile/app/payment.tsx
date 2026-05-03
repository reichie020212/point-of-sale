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
 * Loyalty: when the cart's customer has redemption credit on an
 * active program (locked §9 punchcard model), the matching cart line
 * is auto-discounted to free. On checkout we write per-line punches
 * (one per qualifying non-redeemed unit) and per-line redemption rows
 * (one per redeemed unit).
 *
 * Card / split / Stripe Terminal flow lands when StripeTerminalProvider
 * gets its real implementation in W5.
 */
import { CashProvider } from '@counter/payments';
import { nativeTheme } from '@counter/tokens/native';
import { Q } from '@nozbe/watermelondb';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Money } from '../src/components/Money';
import { database } from '../src/db';
import { useLoyalty } from '../src/hooks/useLoyalty';
import { useAuth } from '../src/state/auth';
import { useCart } from '../src/state/cart';
import { useDevice } from '../src/state/device';
import { useLastSale } from '../src/state/last-sale';
import { useOrgSettings } from '../src/state/org-settings';
import { enqueue } from '../src/sync/queue';

import type { Product as ProductModel } from '../src/db/models/Product';
import type { CartLineSnapshot } from '../src/state/loyalty-helpers';
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
  const identity = useDevice((s) => s.identity);
  const activeUser = useAuth((s) => s.activeUser);
  const taxRate = useOrgSettings((s) => s.settings.taxRate);
  const currency = useOrgSettings((s) => s.settings.currency);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Resolve productId → categoryId for every cart line so the loyalty
  // helpers can match category-targeted programs offline. The query is
  // cheap (cart is short) and runs fresh on every cart mutation.
  const [categoryByProductId, setCategoryByProductId] = useState<Record<string, string | null>>({});
  useEffect(() => {
    const productIds = Array.from(new Set(lines.map((l) => l.productId))).filter(
      (id) => id.length > 0,
    );
    if (productIds.length === 0) {
      setCategoryByProductId({});
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await database
        .get<ProductModel>('products')
        .query(Q.where('server_id', Q.oneOf(productIds)))
        .fetch();
      if (cancelled) return;
      const next: Record<string, string | null> = {};
      for (const row of rows) {
        const raw = (row as unknown as { _raw: { server_id: string; category_id: string | null } })
          ._raw;
        next[raw.server_id] = raw.category_id ?? null;
      }
      setCategoryByProductId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [lines]);

  const cartSnapshots = useMemo<CartLineSnapshot[]>(
    () =>
      lines.map((l) => ({
        lineId: l.lineId,
        productId: l.productId,
        categoryId: categoryByProductId[l.productId] ?? null,
        unitPriceCents: l.unitPriceCents,
        qty: l.qty,
      })),
    [lines, categoryByProductId],
  );

  const loyalty = useLoyalty({ customerId, cartLines: cartSnapshots });
  const loyaltyDiscountCents = loyalty.discountCents;

  const taxableBase = Math.max(0, subtotal - discountCents - loyaltyDiscountCents);
  const taxCents = Math.round(taxableBase * taxRate);
  const totalCents = taxableBase + taxCents + tipCents;

  const onCash = async () => {
    if (lines.length === 0) return;
    setBusy(true);
    setError(null);
    const clientOpId = `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const charge = await cash.charge({
        amountCents: totalCents,
        currency,
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
        currency,
      };
      const items: ReceiptItem[] = lines.map((l) => ({
        nameSnapshot: l.nameSnapshot,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        modifiersSummary:
          l.modifiers.length > 0 ? l.modifiers.map((m) => m.name).join(', ') : undefined,
      }));
      setLastSale({ order, items });

      // Snapshot loyalty math for this checkout so subsequent state
      // changes can't shift the rows we're about to write.
      const orgId = identity?.orgId ?? '';
      const appliedRedemptions = loyalty.applied.map((r) => ({
        ...r,
        clientOpId: makeOpId('punch'),
        serverId: makeUuidLike(),
      }));
      const earnedPunches = loyalty.earnedPunches.map((p) => ({
        ...p,
        clientOpId: makeOpId('punch'),
        serverId: makeUuidLike(),
      }));

      // Optimistic local persistence: write the finalized order +
      // items + loyalty rows to Watermelon so the orders screen
      // observer fires immediately. The server's later PULL emit will
      // reconcile via server_id (clientOpId is also the canonical
      // order id).
      await database.write(async () => {
        const orderCol = database.get('orders');
        const itemsCol = database.get('order_items');
        const punchesCol = database.get('loyalty_punches');
        await orderCol.create((row) => {
          const raw = (row as unknown as { _raw: Record<string, unknown> })._raw;
          raw.server_id = orderId;
          raw.client_op_id = clientOpId;
          raw.org_id = orgId;
          raw.customer_id = customerId;
          raw.shift_id = null;
          raw.device_id = identity?.deviceId ?? '';
          raw.cashier_id = activeUser?.id ?? null;
          raw.status = 'completed';
          raw.payment_method = 'cash';
          raw.subtotal_cents = subtotal;
          raw.tax_cents = taxCents;
          raw.tip_cents = tipCents;
          // Loyalty discount is folded into discount_cents on the
          // order so totals reconcile without a new column.
          raw.discount_cents = discountCents + loyaltyDiscountCents;
          raw.total_cents = totalCents;
          raw.created_at = Date.now();
          raw.synced_at = null;
        });
        for (const line of lines) {
          const modSum = line.modifiers.reduce((m, x) => m + x.priceCents, 0);
          await itemsCol.create((row) => {
            const raw = (row as unknown as { _raw: Record<string, unknown> })._raw;
            raw.server_id = `${orderId}_${line.lineId}`;
            raw.org_id = orgId;
            raw.order_id = orderId;
            raw.variant_id = line.variantId;
            raw.name_snapshot = line.nameSnapshot;
            raw.qty = line.qty;
            raw.unit_price_cents = line.unitPriceCents;
            raw.subtotal_cents = line.qty * (line.unitPriceCents + modSum);
            raw.modifiers_json =
              line.modifiers.length > 0 ? JSON.stringify(line.modifiers) : null;
          });
        }

        if (customerId) {
          for (const punch of earnedPunches) {
            await punchesCol.create((row) => {
              const raw = (row as unknown as { _raw: Record<string, unknown> })._raw;
              raw.server_id = punch.serverId;
              raw.client_op_id = punch.clientOpId;
              raw.org_id = orgId;
              raw.customer_id = customerId;
              raw.program_id = punch.programId;
              raw.order_item_id = `${orderId}_${punch.lineId}`;
              raw.is_redemption = false;
              raw.created_at = Date.now();
            });
          }
          for (const redemption of appliedRedemptions) {
            await punchesCol.create((row) => {
              const raw = (row as unknown as { _raw: Record<string, unknown> })._raw;
              raw.server_id = redemption.serverId;
              raw.client_op_id = redemption.clientOpId;
              raw.org_id = orgId;
              raw.customer_id = customerId;
              raw.program_id = redemption.programId;
              raw.order_item_id = `${orderId}_${redemption.lineId}`;
              raw.is_redemption = true;
              raw.created_at = Date.now();
            });
          }
        }
      });

      // Enqueue an order push for the server. The sync engine drains
      // this queue, the server transactionally writes the order, then
      // emits an EVENT that fans out to other devices and reconciles
      // the local row above via the PULL upsert.
      await enqueue({
        clientOpId,
        table: 'orders',
        payload: {
          id: orderId,
          customerId,
          cashierId: activeUser?.id ?? null,
          paymentMethod: 'cash',
          subtotalCents: subtotal,
          taxCents,
          tipCents,
          discountCents: discountCents + loyaltyDiscountCents,
          totalCents,
          paymentReference: charge.transactionId,
          clientOpId,
        },
        asDelta: false,
      });

      if (customerId) {
        for (const punch of earnedPunches) {
          await enqueue({
            clientOpId: punch.clientOpId,
            table: 'loyalty_punches',
            payload: {
              id: punch.serverId,
              customerId,
              programId: punch.programId,
              orderItemId: `${orderId}_${punch.lineId}`,
              isRedemption: false,
              clientOpId: punch.clientOpId,
            },
            asDelta: false,
          });
        }
        for (const redemption of appliedRedemptions) {
          await enqueue({
            clientOpId: redemption.clientOpId,
            table: 'loyalty_punches',
            payload: {
              id: redemption.serverId,
              customerId,
              programId: redemption.programId,
              orderItemId: `${orderId}_${redemption.lineId}`,
              isRedemption: true,
              clientOpId: redemption.clientOpId,
            },
            asDelta: false,
          });
        }
      }

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
        {loyaltyDiscountCents > 0 && (
          <Row
            label={`Loyalty (${loyalty.applied.length} free)`}
            value={<Money cents={-loyaltyDiscountCents} signed />}
          />
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

function makeOpId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeUuidLike(): string {
  const hex = (n: number) =>
    Math.floor(Math.random() * 16 ** n)
      .toString(16)
      .padStart(n, '0');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
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
