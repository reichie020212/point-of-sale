/**
 * Catalog / sell screen.
 *
 * Reads from the local WatermelonDB via the reactive `useCatalog`
 * hook; the sync engine refills it from the server in the background.
 * No network call sits between a tap and a cart add.
 */
import { nativeTheme } from '@counter/tokens/native';
import { Link, router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Money } from '../src/components/Money';
import { useCatalog, type CatalogEntry } from '../src/hooks/useProducts';
import { useCart } from '../src/state/cart';

export default function SellScreen() {
  const { entries, loading } = useCatalog();
  const subtotal = useCart((s) => s.subtotalCents());
  const lineCount = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const add = useCart((s) => s.add);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={nativeTheme.colors.ink} />
      ) : entries.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No products yet</Text>
          <Text style={styles.emptyHint}>
            Sync will populate the catalog. Add products from the web dashboard, or wait
            for the next pull.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.product.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 8 }}
          contentContainerStyle={{ gap: 8, paddingBottom: 96 }}
          renderItem={({ item }) => (
            <ProductTile
              entry={item}
              onPress={(variant) =>
                add({
                  variantId: variant.id,
                  productId: item.product.id,
                  nameSnapshot: `${item.product.name}${
                    item.variants.length > 1 ? ` (${variant.name})` : ''
                  }`,
                  unitPriceCents: variant.priceCents,
                  modifiers: [],
                })
              }
            />
          )}
        />
      )}

      <Pressable
        style={styles.cartBar}
        onPress={() => router.push('/cart')}
        disabled={lineCount === 0}
      >
        <Text style={styles.cartLabel}>
          {lineCount} item{lineCount === 1 ? '' : 's'}
        </Text>
        <Money cents={subtotal} style={styles.cartTotal} />
      </Pressable>
      <Link href="/settings" style={styles.settingsLink}>
        <Text style={styles.settingsText}>Settings</Text>
      </Link>
    </View>
  );
}

function ProductTile({
  entry,
  onPress,
}: {
  entry: CatalogEntry;
  onPress: (variant: CatalogEntry['variants'][number]) => void;
}) {
  const first = entry.variants[0];
  if (!first) return null;
  return (
    <Pressable style={styles.tile} onPress={() => onPress(first)}>
      <Text style={styles.tileName} numberOfLines={2}>
        {entry.product.name}
      </Text>
      <Money cents={first.priceCents} style={styles.tilePrice} />
      {entry.variants.length > 1 && (
        <Text style={styles.tileMeta}>+{entry.variants.length - 1} more</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 16 },
  emptyBox: {
    padding: 16,
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
  },
  emptyText: { color: nativeTheme.colors.ink, fontSize: 14, fontWeight: '600' },
  emptyHint: { color: nativeTheme.colors.ink3, fontSize: 12, marginTop: 4 },
  tile: {
    flex: 1,
    backgroundColor: nativeTheme.colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nativeTheme.colors.line,
    minHeight: 96,
  },
  tileName: { color: nativeTheme.colors.ink, fontSize: 14, fontWeight: '500' },
  tilePrice: { fontSize: 16, marginTop: 4 },
  tileMeta: { color: nativeTheme.colors.ink3, fontSize: 11, marginTop: 4 },
  cartBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: nativeTheme.colors.ink,
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartLabel: { color: nativeTheme.colors.bg, fontSize: 14, fontWeight: '500' },
  cartTotal: { fontSize: 16, color: nativeTheme.colors.bg },
  settingsLink: { position: 'absolute', top: 16, right: 16 },
  settingsText: { color: nativeTheme.colors.ink3, fontSize: 12 },
});
