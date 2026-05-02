/**
 * Org settings.
 *
 * Read-only view of immutable fields (name, slug, region, tier) plus
 * editable fields (timezone). Region and slug are pinned at sign-up
 * and can't be changed without a data migration; tier is changed via
 * the billing flow, not here.
 */
import { TimezoneSettings } from '../../../../components/TimezoneSettings';
import { api } from '../../../../lib/api';

interface ActiveOrg {
  org: {
    id: string;
    name: string;
    slug: string;
    region: 'US' | 'EU';
    tier: 'free' | 'pro' | 'business';
    timezone: string;
  };
}

export default async function SettingsPage() {
  const { org } = await api<ActiveOrg>('/api/v1/orgs/active');
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-2">
          Shop-wide configuration. Changes apply to every register.
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Identity</h2>
        <dl className="mt-4 grid gap-y-2 text-sm sm:grid-cols-2">
          <dt className="text-ink-3">Name</dt>
          <dd className="text-ink">{org.name}</dd>
          <dt className="text-ink-3">Slug</dt>
          <dd className="font-mono tabular text-ink">{org.slug}</dd>
          <dt className="text-ink-3">Region</dt>
          <dd className="font-mono tabular text-ink">{org.region}</dd>
          <dt className="text-ink-3">Tier</dt>
          <dd className="text-ink">{org.tier}</dd>
        </dl>
        <p className="mt-3 text-xs text-ink-3">
          Slug and region are pinned at sign-up.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
          Business timezone
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Reports and the Today/7d/30d/90d ranges all bucket sales in this zone.
        </p>
        <TimezoneSettings current={org.timezone} />
      </section>
    </div>
  );
}
