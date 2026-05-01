import Link from 'next/link';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
] as const;

export function RangeTabs({ active }: { active: string }) {
  return (
    <nav className="inline-flex rounded-lg border border-line-2 bg-surface p-1 text-sm">
      {RANGES.map((r) => {
        const isActive = r.key === active;
        return (
          <Link
            key={r.key}
            href={r.key === 'today' ? '/dashboard' : `/dashboard?range=${r.key}`}
            className={
              isActive
                ? 'rounded-md bg-ink px-3 py-1.5 font-medium text-bg'
                : 'rounded-md px-3 py-1.5 text-ink-2 hover:text-ink'
            }
          >
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}
