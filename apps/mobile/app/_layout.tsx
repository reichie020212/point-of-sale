import { nativeTheme } from '@counter/tokens/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { SyncBanner } from '../src/components/SyncBanner';

// TODO(M5): preload JetBrainsMono-Regular, Inter, and Fraunces via
// expo-font and gate the splash on the fontsLoaded boolean. The earlier
// scaffold pointed at a Roboto path inside react-native internals, which
// stopped resolving in RN 0.74 and broke `expo export`. System fonts
// render acceptably until real font assets ship.
export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: nativeTheme.colors.bg }}>
      <StatusBar style="dark" />
      <SyncBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: nativeTheme.colors.surface },
          headerTitleStyle: { color: nativeTheme.colors.ink },
          contentStyle: { backgroundColor: nativeTheme.colors.bg },
        }}
      />
    </View>
  );
}
