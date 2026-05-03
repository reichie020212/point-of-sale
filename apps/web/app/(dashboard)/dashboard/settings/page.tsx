/**
 * Org settings.
 *
 * Read-only view of immutable fields (name, slug, region, tier,
 * currency) plus editable fields (timezone, tax rate). Region, slug,
 * and currency are pinned at sign-up and can't be changed without a
 * data migration; tier is changed via the billing flow, not here.
 */
import { TaxRateSettings } from '../../../../components/TaxRateSettings';
import { TeamPinSettings } from '../../../../components/TeamPinSettings';
import { TimezoneSettings } from '../../../../components/TimezoneSettings';
import { api } from '../../../../lib/api';

interface ActiveOrg {
  org: {
    id: string;
    name: string;
    slug: string;
    region: 'US' | 'EU' | 'PH';
    tier: 'free' | 'pro' | 'business';
    timezone: string;
    currency: string;
    taxRate: string;
  };
}

interface TeamUser {
  id: string;
  email: string;
  name: string | null;
  role: 'owner' | 'manager' | 'cashier';
  hasPin: boolean;
}

export default async function SettingsPage() {
  const { org } = await api<ActiveOrg>('/api/v1/orgs/active');
  let team: TeamUser[] = [];
  try {
    const res = await api<{ users: TeamUser[] }>('/api/v1/users');
    team = res.users;
  } catch {
    // Surfacing this as an error would block the rest of the page;
    // settings remains usable without team data.
  }
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
          <dt className="text-ink-3">Currency</dt>
          <dd className="font-mono tabular text-ink">{org.currency}</dd>
          <dt className="text-ink-3">Tier</dt>
          <dd className="text-ink">{org.tier}</dd>
        </dl>
        <p className="mt-3 text-xs text-ink-3">
          Slug, region, and currency are pinned at sign-up.
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

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
          Tax rate
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          A single flat percentage applied to every sale. PH VAT defaults
          to <span className="font-mono tabular">12.000%</span>; set this to
          <span className="font-mono tabular"> 0</span> for tax-exempt
          businesses. Changes apply to new sales only.
        </p>
        <TaxRateSettings current={org.taxRate} />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
          Team PINs
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Each cashier signs in to the mobile register with a 4-digit
          PIN. PINs sync to every paired device so sign-in works
          offline. Owner / manager only.
        </p>
        <TeamPinSettings team={team} />
      </section>
    </div>
  );
}
