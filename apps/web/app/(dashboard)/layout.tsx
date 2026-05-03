/**
 * Dashboard route-group layout.
 *
 * Gates the entire `/dashboard/*` tree on tier ≥ pro per master Blueprint
 * §8 step 12. Free orgs get redirected to /pricing — the dashboard's
 * value (sync, reports, multi-device) requires a paid plan, so showing
 * a neutered version would be misleading.
 *
 * HANDOFF §3 conflict: "Free tier requires no account" applies to the
 * mobile sell loop, not this web dashboard. The mobile app's sync client
 * accepts a tier_required close cleanly; the local sell flow keeps
 * working without the server. See docs/blueprints/master-w2-w8.md §6.
 *
 * TODO(open-question): once the tier matrix is locked (HANDOFF §9),
 * confirm whether free orgs should see a stripped-down dashboard
 * instead of a hard redirect.
 */
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ApiError, api } from '../../lib/api';

import type { ReactNode } from 'react';

interface ActiveOrg {
  org: { id: string; name: string; tier: 'free' | 'pro' | 'business' };
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let active: ActiveOrg['org'] | null = null;
  try {
    const res = await api<ActiveOrg>('/api/v1/orgs/active');
    active = res.org;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      redirect('/onboarding');
    }
    throw err;
  }
  if (active.tier === 'free') redirect('/pricing');

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-display text-xl text-ink">
            Counter
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-ink-2 md:flex">
            <Link href="/dashboard/products" className="hover:text-ink">
              Products
            </Link>
            <Link href="/dashboard/customers" className="hover:text-ink">
              Customers
            </Link>
            <Link href="/dashboard/loyalty" className="hover:text-ink">
              Loyalty
            </Link>
            <Link href="/dashboard/registers" className="hover:text-ink">
              Registers
            </Link>
            <Link href="/dashboard/settings" className="hover:text-ink">
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink-3">{active.name}</span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
