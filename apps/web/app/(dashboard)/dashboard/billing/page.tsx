/**
 * Billing — current subscription summary + portal access.
 *
 * Free orgs never land here because the dashboard layout redirects
 * them to /pricing. Reaching this page implies tier ∈ {pro, business}.
 *
 * The "Manage billing" form action is gated by `requireRole(['owner'])`
 * on the API, so a manager / cashier hitting submit is bounced back
 * with `?status=role_required`. We don't pre-hide the button because
 * doing it correctly would need a `GET /api/v1/users/me` round-trip;
 * the 403 + status banner is acceptable UX for the small fraction of
 * non-owners who land here.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ApiError, api } from '../../../../lib/api';

interface ActiveOrg {
  org: {
    id: string;
    name: string;
    tier: 'free' | 'pro' | 'business';
  };
}

async function openPortal() {
  'use server';
  let url: string;
  try {
    const res = await api<{ url: string }>('/api/v1/billing/portal', { method: 'POST' });
    url = res.url;
  } catch (err) {
    if (err instanceof ApiError) {
      redirect(`/dashboard/billing?status=${err.code}`);
    }
    throw err;
  }
  redirect(url);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { org } = await api<ActiveOrg>('/api/v1/orgs/active');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Billing</h1>
        <p className="mt-1 text-sm text-ink-2">
          Plan summary for <span className="font-medium text-ink">{org.name}</span>.
        </p>
      </header>

      {searchParams.status === 'success' && (
        <p className="rounded-xl border border-ok bg-surface-2 p-4 text-sm text-ink-2">
          Plan updated. It can take a moment for the new tier to propagate.
        </p>
      )}
      {searchParams.status === 'no_subscription' && (
        <p className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-ink-2">
          We don&rsquo;t have a Stripe customer for this org yet. Pick a plan on the{' '}
          <Link href="/pricing" className="underline">
            pricing page
          </Link>
          .
        </p>
      )}
      {searchParams.status === 'role_required' && (
        <p className="rounded-xl border border-bad bg-surface-2 p-4 text-sm text-ink-2">
          Only the org owner can change billing.
        </p>
      )}
      {searchParams.status === 'billing_not_configured' && (
        <p className="rounded-xl border border-bad bg-surface-2 p-4 text-sm text-ink-2">
          Billing isn&rsquo;t fully wired on this deployment yet.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Current plan</h2>
        <dl className="mt-4 grid gap-y-2 text-sm sm:grid-cols-2">
          <dt className="text-ink-3">Tier</dt>
          <dd className="font-mono tabular text-ink">{org.tier}</dd>
        </dl>
        <p className="mt-4 text-xs text-ink-3">
          Renewal date, payment method, and invoice history are managed in
          Stripe&rsquo;s hosted portal.
        </p>

        <form action={openPortal} className="mt-4">
          <button
            type="submit"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
          >
            Manage billing
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Change plan</h2>
        <p className="mt-2 text-sm text-ink-2">
          Upgrade or compare features on the{' '}
          <Link href="/pricing" className="underline">
            pricing page
          </Link>
          . Downgrades happen through the Stripe portal.
        </p>
      </section>
    </div>
  );
}
