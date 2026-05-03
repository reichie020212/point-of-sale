import { nativeTheme } from '@counter/tokens/native';
import { Fraunces_400Regular, Fraunces_400Regular_Italic, Fraunces_500Medium, Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { SyncBanner } from '../src/components/SyncBanner';
import {
  applyTelemetryPreference,
  identifyDevice,
} from '../src/observability/posthog';
import { initSentry, Sentry } from '../src/observability/sentry';
import { useDevice } from '../src/state/device';
import { useOrgSettings } from '../src/state/org-settings';

// Keep splash visible until brand fonts are decoded — flash-of-fallback
// would render prices in system mono and break the "every price is
// JetBrains Mono" non-negotiable.
void SplashScreen.preventAutoHideAsync();

// Sentry init runs at module load (before React mounts) so the global
// error handler is wired up in time to catch crashes from the very
// first paint. No-op when EXPO_PUBLIC_SENTRY_DSN is unset.
initSentry();

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium_Italic,
  });
  const hydrate = useDevice((s) => s.hydrate);
  const identity = useDevice((s) => s.identity);
  const hydrateOrgSettings = useOrgSettings((s) => s.hydrate);
  const refreshOrgSettings = useOrgSettings((s) => s.refresh);
  const telemetryEnabled = useOrgSettings((s) => s.settings.telemetryEnabled);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    void hydrateOrgSettings();
  }, [hydrateOrgSettings]);
  useEffect(() => {
    // Pull the latest tax rate + currency every time the device pairs
    // (or boots into an existing pairing). Failures are tolerated —
    // the cached settings or hard-coded PH defaults keep the cart
    // usable offline.
    if (identity) void refreshOrgSettings();
  }, [identity, refreshOrgSettings]);
  useEffect(() => {
    // Identify the register to PostHog whenever the device pairs.
    identifyDevice(identity?.deviceId ?? null, identity?.orgId ?? null);
  }, [identity]);
  useEffect(() => {
    // Honor the org's telemetry preference reactively. The synced
    // org row carries the flag; useOrgSettings.applyFromRecord lands
    // it here on every EVENT.
    applyTelemetryPreference(telemetryEnabled);
  }, [telemetryEnabled]);
  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: nativeTheme.colors.bg }}>
      <StatusBar style="dark" />
      <SyncBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: nativeTheme.colors.surface },
          headerTitleStyle: { color: nativeTheme.colors.ink, fontFamily: nativeTheme.fonts.display },
          contentStyle: { backgroundColor: nativeTheme.colors.bg },
        }}
      />
    </View>
  );
}

// `Sentry.wrap` adds an ErrorBoundary at the React root so a JS crash
// renders Sentry's fallback instead of leaving the cashier on a
// frozen white screen. Acts as a no-op when the SDK isn't configured.
export default Sentry.wrap(RootLayout);
