/**
 * React Native platform export — pure JS values, ready to drop into
 * `StyleSheet.create({...})`. RN does not have CSS variables, so consumers
 * import these directly:
 *
 *   import { nativeTheme } from '@counter/tokens/native';
 *   const styles = StyleSheet.create({
 *     price: { ...nativeTheme.text.money, color: nativeTheme.colors.ink },
 *   });
 *
 * Hex fallbacks only — RN as of late 2025 still doesn't render OKLCH on
 * Android. When that lands, swap individual entries for OKLCH and bump the
 * minimum supported RN version.
 */
import { colors } from '../colors.js';
import { radii } from '../radii.js';
import { spacing } from '../spacing.js';
import { fontFamilies, fontWeights } from '../typography.js';

export const nativeTheme = {
  colors: {
    bg: colors.bg.hex,
    surface: colors.surface.hex,
    surface2: colors.surface2.hex,
    ink: colors.ink.hex,
    ink2: colors.ink2.hex,
    ink3: colors.ink3.hex,
    line: colors.line.hex,
    line2: colors.line2.hex,
    accent: colors.accent.hex,
    accentDeep: colors.accentDeep.hex,
    accentSoft: colors.accentSoft.hex,
    ok: colors.ok.hex,
    warn: colors.warn.hex,
    bad: colors.bad.hex,
  },
  // Family names mirror @expo-google-fonts/{inter,jetbrains-mono,fraunces}.
  // RN cannot synthesize bold/italic from a single ttf, so each weight ships
  // as its own family; consumers pick the exact face they want.
  fonts: {
    ui: 'Inter_400Regular',
    uiMedium: 'Inter_500Medium',
    uiSemibold: 'Inter_600SemiBold',
    uiBold: 'Inter_700Bold',
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
    monoSemibold: 'JetBrainsMono_600SemiBold',
    monoBold: 'JetBrainsMono_700Bold',
    display: 'Fraunces_400Regular',
    displayItalic: 'Fraunces_400Regular_Italic',
    displayMedium: 'Fraunces_500Medium',
    displayMediumItalic: 'Fraunces_500Medium_Italic',
    families: fontFamilies,
  },
  weights: fontWeights,
  spacing,
  radii,
  text: {
    money: {
      fontFamily: 'JetBrainsMono_400Regular',
    },
  },
} as const;

export type NativeTheme = typeof nativeTheme;
