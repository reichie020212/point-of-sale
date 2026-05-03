/**
 * Stripe SDK init.
 *
 * Lazy: returns null when STRIPE_SECRET_KEY is unset so the rest of
 * the API can still boot without Stripe credentials wired up. Routes
 * that depend on the SDK should call `getStripe()` and respond with
 * 503 when it's missing — that keeps `pnpm dev` and CI green for
 * contributors who haven't set up a Stripe sandbox.
 *
 * Production deployments MUST set the env var; we deliberately don't
 * fail-fast here because CI also doesn't have it.
 */
import Stripe from 'stripe';

let cached: Stripe | null = null;
let cachedKey: string | undefined;

export function getStripe(secretKey: string | undefined): Stripe | null {
  if (!secretKey) return null;
  if (cached && cachedKey === secretKey) return cached;
  cached = new Stripe(secretKey, {
    // Pin the API version so adding a new SDK release can't silently
    // change webhook payload shape under us. Bump intentionally.
    apiVersion: '2024-10-28.acacia',
    typescript: true,
    appInfo: { name: 'Counter POS', version: '0.0.0' },
  });
  cachedKey = secretKey;
  return cached;
}

/** Test-only escape hatch — clears the cached client between test runs. */
export function _resetStripeCache(): void {
  cached = null;
  cachedKey = undefined;
}

/**
 * Map a Stripe price id back to a Counter tier. The webhook needs
 * this to flip `organizations.tier` after a successful checkout.
 * Returns null when the price id doesn't match either configured
 * paid tier (e.g. someone pointed Stripe at a different product).
 */
export function priceIdToTier(
  priceId: string,
  cfg: { proPriceId: string | undefined; businessPriceId: string | undefined },
): 'pro' | 'business' | null {
  if (cfg.proPriceId && priceId === cfg.proPriceId) return 'pro';
  if (cfg.businessPriceId && priceId === cfg.businessPriceId) return 'business';
  return null;
}
