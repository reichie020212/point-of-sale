/**
 * Orders / history screen.
 *
 * Reactive read of the local Watermelon `orders` table. New sales —
 * whether finalized on this device or arriving via broker fan-out from
 * another device — appear without manual refresh.
 *
 * Refund flow is still TODO; this screen is currently view-only.
 */
import { nativeTheme } from '@counter/tokens/native';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Money } from '../src/components/Money';
import { useOrders, type OrderSummary } from '../src/hooks/useOrders';

export default function OrdersScreen() {
  const { orders, loading } = useOrders();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Order history</Text>
      {loading ? (
        <ActivityIndicator color={nativeTheme.colors.ink} />
      ) : orders.length === 0 ? (
        <Text style={styles.body}>No orders yet. Complete a sale to see it here.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
          renderItem={({ item }) => <OrderRow order={item} />}
        />
      )}
    </View>
  );
}

function OrderRow({ order }: { order: OrderSummary }) {
  const time = new Date(order.createdAtMs).toLocaleString();
  const synced = order.syncedAtMs != null;
  return (
    <View style={styles.row}>
      <View style={styles.rowMeta}>
        <Text style={styles.rowTime}>{time}</Text>
        <Text style={styles.rowMethod}>
          {order.paymentMethod} · {synced ? 'synced' : 'queued'}
        </Text>
      </View>
      <Money cents={order.totalCents} style={styles.rowTotal} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600', marginBottom: 16 },
  body: { color: nativeTheme.colors.ink2, fontSize: 14, marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  rowMeta: { gap: 2 },
  rowTime: { color: nativeTheme.colors.ink, fontSize: 14, fontVariant: ['tabular-nums'] },
  rowMethod: { color: nativeTheme.colors.ink3, fontSize: 11 },
  rowTotal: { fontSize: 18 },
});
