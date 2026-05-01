/**
 * Catalog / sell screen.
 *
 * M5: pulls products + variants from the API and renders a tap-to-add
 * grid. Tapping a variant adds it to the in-memory cart. M6 swaps
 * the data source to WatermelonDB so this works offline.
 */
import { nativeTheme } from '@counter/tokens/native';
import { Link, router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Money } from '../src/components/Money';
import { useCatalog, type CatalogEntry } from '../src/hooks/useProducts';
import { useCart } from '../src/state/cart';

export default function SellScreen() {
  const { entries, error, loading } = useCatalog();
  const subtotal = useCart((s) => s.subtotalCents());
  const lineCount = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const add = useCart((s) => s.add);

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Set the dev token in Settings or run `pnpm --filter @counter/api dev`.
          </Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={nativeTheme.colors.ink} />
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
  errorBox: {
    padding: 16,
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.bad,
    borderWidth: 1,
    borderRadius: 12,
  },
  errorText: { color: nativeTheme.colors.bad, fontSize: 14, fontWeight: '600' },
  errorHint: { color: nativeTheme.colors.ink3, fontSize: 12, marginTop: 4 },
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
