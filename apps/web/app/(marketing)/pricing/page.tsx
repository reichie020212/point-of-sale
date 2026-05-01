/**
 * Pricing — placeholder.
 *
 * Lands as a real comparison table once the tier matrix is locked
 * (HANDOFF §9 open-question). For now it explains the gating and
 * gives a link back to the dashboard.
 */
import Link from 'next/link';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    blurb: 'One register. Local sells. Forever.',
    features: ['Unlimited products', 'CSV export', 'No account required'],
  },
  {
    name: 'Pro',
    price: '$29 / mo',
    blurb: 'Sync your registers, see your numbers.',
    features: ['Multi-device sync', 'Reports + charts', 'Customers + loyalty', 'Email receipts'],
    highlight: true,
  },
  {
    name: 'Business',
    price: '$79 / mo',
    blurb: 'Multi-location and team controls.',
    features: ['Everything in Pro', 'Multi-location', 'Role-based access', 'Priority support'],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <header className="text-center">
        <h1 className="font-display text-4xl text-ink">Pricing</h1>
        <p className="mt-2 text-ink-2">Free forever. Sync when you grow.</p>
      </header>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <section
            key={tier.name}
            className={
              'rounded-2xl border p-6 ' +
              (tier.highlight
                ? 'border-accent-deep bg-accent-soft'
                : 'border-line bg-surface')
            }
          >
            <h2 className="font-display text-xl text-ink">{tier.name}</h2>
            <p className="mt-2 font-mono text-3xl tabular text-ink">{tier.price}</p>
            <p className="mt-2 text-sm text-ink-2">{tier.blurb}</p>
            <ul className="mt-6 space-y-2 text-sm text-ink-2">
              {tier.features.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
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
