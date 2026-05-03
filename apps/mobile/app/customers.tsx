/**
 * Customers screen.
 *
 * Reactive list of locally-mirrored customers with a substring search
 * over name/email/phone. Loyalty points come from the server's PULL
 * upsert and re-render here automatically when they change.
 */
import { nativeTheme } from '@counter/tokens/native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { PunchProgress } from '../src/components/PunchProgress';
import { useCustomers, type CustomerSummary } from '../src/hooks/useCustomers';

export default function CustomersScreen() {
  const [query, setQuery] = useState('');
  const { customers, loading } = useCustomers(query);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Customers</Text>
      <TextInput
        style={styles.search}
        placeholder="Search name, email, or phone"
        placeholderTextColor={nativeTheme.colors.ink3}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator color={nativeTheme.colors.ink} />
      ) : customers.length === 0 ? (
        <Text style={styles.body}>
          {query ? 'No matches.' : 'No customers yet. They sync in from the dashboard.'}
        </Text>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
          renderItem={({ item }) => <CustomerRow customer={item} />}
        />
      )}
    </View>
  );
}

function CustomerRow({ customer }: { customer: CustomerSummary }) {
  const sub = customer.email ?? customer.phone ?? '';
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {customer.name ?? 'Unnamed'}
        </Text>
        {sub.length > 0 && (
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        )}
        <PunchProgress customerId={customer.id} variant="row" />
      </View>
      <Text style={styles.rowPoints}>{customer.loyaltyPoints} pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600', marginBottom: 16 },
  search: {
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: nativeTheme.colors.ink,
    fontSize: 14,
    marginBottom: 12,
  },
  body: { color: nativeTheme.colors.ink2, fontSize: 14, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: nativeTheme.colors.surface,
    borderColor: nativeTheme.colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  rowName: { color: nativeTheme.colors.ink, fontSize: 14, fontWeight: '500' },
  rowSub: { color: nativeTheme.colors.ink3, fontSize: 12, marginTop: 2 },
  rowPoints: {
    color: nativeTheme.colors.ink2,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
