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


interface Props extends TextProps {
  cents: number;
  /** ISO 4217 currency code. Default 'USD'. TODO(policy-region): per-org. */
  currency?: string;
  /** Shows a leading +/-, useful for refunds and discounts. */
  signed?: boolean;
}

export function Money({ cents, currency = 'USD', signed = false, style, ...rest }: Props) {
  const amount = Math.abs(cents) / 100;
  const sign = signed ? (cents < 0 ? '-' : cents > 0 ? '+' : '') : cents < 0 ? '-' : '';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
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
