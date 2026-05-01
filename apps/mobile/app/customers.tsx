import { nativeTheme } from '@counter/tokens/native';
import { StyleSheet, Text, View } from 'react-native';

export default function CustomersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Customers</Text>
      <Text style={styles.body}>Customer search and loyalty land in M10.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: nativeTheme.colors.bg, padding: 24 },
  heading: { color: nativeTheme.colors.ink, fontSize: 24, fontWeight: '600' },
  body: { color: nativeTheme.colors.ink2, fontSize: 14, marginTop: 8 },
});
