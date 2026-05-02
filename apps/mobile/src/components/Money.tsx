/**
 * Money component — every price in the app renders through this.
 *
 * Enforces HANDOFF non-negotiable #3: every price is JetBrains Mono
 * with tabular numerals. The CLAUDE.md no-restricted-syntax color
 * rule blocks raw color literals in app code; this component lives
 * one level above raw `<Text>` and centralises the typography
 * decision so it never drifts.
 */
import { nativeTheme } from '@counter/tokens/native';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { useOrgSettings } from '../state/org-settings';


interface Props extends TextProps {
  cents: number;
  /** ISO 4217 currency code. Defaults to the active org's currency. */
  currency?: string;
  /** Shows a leading +/-, useful for refunds and discounts. */
  signed?: boolean;
}

export function Money({ cents, currency, signed = false, style, ...rest }: Props) {
  const orgCurrency = useOrgSettings((s) => s.settings.currency);
  const code = currency ?? orgCurrency;
  const amount = Math.abs(cents) / 100;
  const sign = signed ? (cents < 0 ? '-' : cents > 0 ? '+' : '') : cents < 0 ? '-' : '';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
  }).format(amount);
  return (
    <Text style={[styles.money, style]} {...rest}>
      {sign}
      {formatted.replace(/^-/, '')}
    </Text>
  );
}

const styles = StyleSheet.create({
  money: {
    fontFamily: nativeTheme.text.money.fontFamily,
    fontVariant: ['tabular-nums'],
    color: nativeTheme.colors.ink,
  },
});
