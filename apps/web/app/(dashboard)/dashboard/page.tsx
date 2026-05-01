/**
 * Dashboard — KPI cards + sales-over-time + top items.
 *
 * Replaces the W1 placeholder. Recharts lives in the client `SalesChart`
 * component; everything else is server-rendered. Money fields render in
 * JetBrains Mono per HANDOFF non-negotiable #3. Current-hour band on
 * the chart is the highlight from HANDOFF §3.
 */
import { RangeTabs } from '../../../components/RangeTabs';
import { SalesChart } from '../../../components/SalesChart';
import { ApiError, api } from '../../../lib/api';

interface Summary {
  grossCents: number;
  orders: number;
  avgTicketCents: number;
  netCents: number;
}

interface Report {
  range: 'today' | '7d' | '30d' | '90d';
  window: { start: string; end: string; bucket: 'hour' | 'day' };
  summary: { current: Summary; previous: Summary; delta: { grossCents: number; orders: number; netCents: number } };
  series: { bucket: string; grossCents: number; orders: number }[];
  topItems: { variantId: string; name: string; qty: number; grossCents: number }[];
}

const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtPercent = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? '—' : '▲';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const range =
    searchParams.range === '7d' || searchParams.range === '30d' || searchParams.range === '90d'
      ? searchParams.range
      : 'today';

  let report: Report | null = null;
  let error: string | null = null;
  try {
    report = await api<Report>('/api/v1/reports/dashboard', { query: { range } });
  } catch (err) {
    error = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'unknown error';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-2">
            {range === 'today'
              ? 'Live performance for today.'
              : `Last ${range === '7d' ? '7' : range === '30d' ? '30' : '90'} days.`}
          </p>
        </div>
        <RangeTabs active={range} />
      </header>

      {error ? (
        <div className="rounded-xl border border-bad bg-surface p-4 text-bad">{error}</div>
      ) : report ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Gross"
              value={fmtMoney(report.summary.current.grossCents)}
              delta={fmtPercent(report.summary.current.grossCents, report.summary.previous.grossCents)}
              positive={report.summary.delta.grossCents >= 0}
            />
            <KpiCard
              label="Orders"
              value={report.summary.current.orders.toLocaleString('en-US')}
              delta={fmtPercent(report.summary.current.orders, report.summary.previous.orders)}
              positive={report.summary.delta.orders >= 0}
            />
            <KpiCard
              label="Avg ticket"
              value={fmtMoney(report.summary.current.avgTicketCents)}
              delta={fmtPercent(
                report.summary.current.avgTicketCents,
                report.summary.previous.avgTicketCents,
              )}
              positive={
                report.summary.current.avgTicketCents - report.summary.previous.avgTicketCents >= 0
              }
            />
            <KpiCard
              label="Net"
              value={fmtMoney(report.summary.current.netCents)}
              delta={fmtPercent(report.summary.current.netCents, report.summary.previous.netCents)}
              positive={report.summary.delta.netCents >= 0}
            />
          </div>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg text-ink">Sales over time</h2>
            <p className="text-sm text-ink-3">
              Bucketed by {report.window.bucket}. Amber band marks the current hour.
            </p>
            <div className="mt-4">
              <SalesChart data={report.series} bucket={report.window.bucket} />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg text-ink">Top items</h2>
            {report.topItems.length === 0 ? (
              <p className="mt-2 text-sm text-ink-3">No sales in this range yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {report.topItems.map((item) => (
                  <li
                    key={item.variantId}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <div className="text-ink">{item.name}</div>
                    <div className="flex items-center gap-6 text-ink-2">
                      <span className="font-mono tabular text-ink-3">×{item.qty}</span>
                      <span className="font-mono tabular text-ink">
                        {fmtMoney(item.grossCents)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  positive,
}: {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="text-sm text-ink-3">{label}</p>
      <p className="mt-1 font-mono text-3xl text-ink tabular">{value}</p>
      <p
        className={
          'mt-2 font-mono text-xs tabular ' + (positive ? 'text-ok' : 'text-bad')
        }
      >
        {delta} vs prev
      </p>
    </div>
  );
}
