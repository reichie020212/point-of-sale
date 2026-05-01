/**
 * Week 1 dashboard placeholder. Demonstrates that:
 *   - Clerk auth gates this route via middleware.ts
 *   - @counter/tokens CSS variables drive Tailwind colors
 *   - JetBrains Mono is wired up for money / timestamps (HANDOFF non-negotiable #3)
 *
 * Replace with real KPIs in Week 6.
 */
export default function DashboardPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Dashboard</h1>
      <p className="mt-2 text-ink-2">Welcome to Counter. Today, this is empty.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <KpiCard label="Gross today" value="$0.00" />
        <KpiCard label="Orders today" value="0" />
        <KpiCard label="Avg ticket" value="$0.00" />
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="text-sm text-ink-3">{label}</p>
      <p className="mt-1 font-mono text-3xl text-ink tabular">{value}</p>
    </div>
  );
}
