import { nativeTheme } from '@counter/tokens/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { SyncBanner } from '../src/components/SyncBanner';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter: require('react-native/Libraries/NewAppScreen/components/fonts/Roboto-Regular.ttf'), // TODO(M5): bundle real Inter
  });

  useEffect(() => {
    // TODO(M5): preload JetBrainsMono-Regular and Fraunces with expo-font
    // and gate the splash on fontsLoaded.
    void fontsLoaded;
  }, [fontsLoaded]);

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
