import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
        <Link href="/dashboard" className="font-display text-xl text-ink">
          Counter
        </Link>
        <UserButton afterSignOutUrl="/" />
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
