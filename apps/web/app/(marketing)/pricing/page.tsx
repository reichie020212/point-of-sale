/**
 * Pricing — public marketing page.
 *
 * Tiers and PHP price points are display copy only; the *actual*
 * recurring price the cardholder is charged comes from Stripe (the
 * `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS` env vars on the API
 * point to the canonical Price objects). Keep these in sync manually.
 *
 * The "Upgrade" CTA on each paid tier is a Server Action that calls
 * `POST /api/v1/billing/checkout`, then redirects the browser to the
 * hosted Stripe Checkout page. Unauthenticated visitors get bounced
 * to /sign-in first; the post-sign-in landing brings them back here.
 */
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ApiError, api } from '../../../lib/api';

interface CheckoutResponse {
  url: string;
}

interface TierDef {
  id: 'free' | 'pro' | 'business';
  name: string;
  price: string;
  blurb: string;
  features: string[];
  highlight?: boolean;
}

const TIERS: TierDef[] = [
  {
    id: 'free',
    name: 'Free',
    price: '₱0',
    blurb: 'One register. Local sells. Forever.',
    features: ['Unlimited products', 'CSV export', 'No account required'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₱1,499 / mo',
    blurb: 'Sync your registers, see your numbers.',
    features: ['Multi-device sync', 'Reports + charts', 'Customers + loyalty', 'Email receipts'],
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '₱3,999 / mo',
    blurb: 'Multi-location and team controls.',
    features: ['Everything in Pro', 'Multi-location', 'Role-based access', 'Priority support'],
  },
];

async function startCheckout(formData: FormData) {
  'use server';
  const tier = formData.get('tier');
  if (tier !== 'pro' && tier !== 'business') {
    redirect('/pricing?status=invalid_tier');
  }
  const { userId } = auth();
  if (!userId) {
    redirect('/sign-in?redirect_url=/pricing');
  }
  let url: string;
  try {
    const res = await api<CheckoutResponse>('/api/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
    url = res.url;
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      // Stripe not configured on this deployment yet — surface a
      // soft failure rather than crashing the marketing page.
      redirect('/pricing?status=billing_not_configured');
    }
    throw err;
  }
  redirect(url);
}

export default function PricingPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <header className="text-center">
        <h1 className="font-display text-4xl text-ink">Pricing</h1>
        <p className="mt-2 text-ink-2">Free forever. Sync when you grow.</p>
      </header>

      {searchParams.status === 'canceled' && (
        <p className="mt-6 rounded-xl border border-line bg-surface-2 p-4 text-center text-sm text-ink-2">
          Checkout canceled. Pick a plan whenever you're ready.
        </p>
      )}
      {searchParams.status === 'billing_not_configured' && (
        <p className="mt-6 rounded-xl border border-bad bg-surface-2 p-4 text-center text-sm text-ink-2">
          Billing isn't fully wired on this deployment yet.
        </p>
      )}

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <section
            key={tier.id}
            className={
              'flex flex-col rounded-2xl border p-6 ' +
              (tier.highlight ? 'border-accent-deep bg-accent-soft' : 'border-line bg-surface')
            }
          >
            <h2 className="font-display text-xl text-ink">{tier.name}</h2>
            <p className="mt-2 font-mono text-3xl tabular text-ink">{tier.price}</p>
            <p className="mt-2 text-sm text-ink-2">{tier.blurb}</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-ink-2">
              {tier.features.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
            <div className="mt-6">
              {tier.id === 'free' ? (
                <Link
                  href="/sign-up"
                  className="block rounded-lg border border-line bg-surface px-4 py-2 text-center text-sm text-ink hover:bg-surface-2"
                >
                  Get started
                </Link>
              ) : (
                <form action={startCheckout}>
                  <input type="hidden" name="tier" value={tier.id} />
                  <button
                    type="submit"
                    className={
                      'w-full rounded-lg px-4 py-2 text-center text-sm font-medium transition ' +
                      (tier.highlight
                        ? 'bg-ink text-bg hover:opacity-90'
                        : 'border border-line bg-surface text-ink hover:bg-surface-2')
                    }
                  >
                    Upgrade to {tier.name}
                  </button>
                </form>
              )}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-ink-3">
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
