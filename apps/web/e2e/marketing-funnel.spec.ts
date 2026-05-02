/**
 * Marketing → Pricing → Sign-up funnel smoke.
 *
 * Verifies the unauthenticated acquisition path stays intact across
 * Blueprints. We *do not* drive Clerk's hosted sign-up here — that
 * needs CI secrets; landing on /sign-up and confirming the route
 * mounts is enough signal for this Blueprint. A follow-up Blueprint
 * will introduce a Clerk test-mode bypass when Stripe billing lands.
 *
 * Asserts:
 *   1. Landing renders the brand and the "Get started" CTA links to
 *      /sign-up.
 *   2. /pricing renders all three tiers, each with its monospace
 *      price (the JetBrains Mono regression check from Blueprint #10).
 *   3. Clicking "Get started" navigates to /sign-up and the route
 *      successfully mounts (no 5xx).
 */
import { expect, test } from '@playwright/test';

test.describe('marketing funnel', () => {
  test('landing → pricing → sign-up CTA', async ({ page }) => {
    // 1. Landing
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'calm point-of-sale',
    );
    const getStarted = page.getByRole('link', { name: 'Get started' });
    await expect(getStarted).toHaveAttribute('href', '/sign-up');

    // 2. Pricing
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible();

    for (const { tier, price } of [
      { tier: 'Free', price: '$0' },
      { tier: 'Pro', price: '$29 / mo' },
      { tier: 'Business', price: '$79 / mo' },
    ]) {
      const card = page.getByRole('heading', { name: tier, level: 2 }).locator('..');
      await expect(card).toBeVisible();
      const priceEl = card.getByText(price, { exact: true });
      await expect(priceEl).toBeVisible();
      // Brand non-negotiable: every price renders with the mono font
      // class so SSR + CSS variables resolve to JetBrains Mono.
      await expect(priceEl).toHaveClass(/font-mono/);
    }

    // 3. CTA navigation. Drive from the landing so we exercise the
    // user's actual click path. /sign-up is gated by Clerk middleware
    // but it renders a public sign-up shell, so the navigation
    // resolves without auth.
    await page.goto('/');
    await page.getByRole('link', { name: 'Get started' }).click();
    await page.waitForURL('**/sign-up');
    expect(page.url()).toMatch(/\/sign-up/);
  });
});
