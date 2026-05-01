/**
 * Customers dashboard — search + list. Detail + order history land
 * once /api/v1/orders is exposed (post-M14).
 */
import { ExportButton } from '../../../../components/ExportButton';
import { api } from '../../../../lib/api';

interface CustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  loyaltyPoints: number;
  updatedAt: string;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q ?? '';
  let customers: CustomerRow[] = [];
  let error: string | null = null;
  try {
    const res = await api<{ customers: CustomerRow[] }>('/api/v1/customers', {
      query: { limit: 100, q: q || undefined },
    });
    customers = res.customers;
  } catch (err) {
    error = err instanceof Error ? err.message : 'unknown error';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Customers</h1>
          <p className="mt-1 text-sm text-ink-2">
            {customers.length} customer{customers.length === 1 ? '' : 's'}
            {q && ` matching “${q}”`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, email, phone…"
              className="rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm text-ink"
            />
            <button
              type="submit"
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg hover:bg-ink-2"
            >
              Search
            </button>
          </form>
          <ExportButton entity="customers" />
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-bad bg-surface p-4 text-bad">{error}</div>
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 bg-surface p-12 text-center text-ink-3">
          No customers yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-surface-2 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-ink-2">Name</th>
                <th className="px-4 py-3 font-medium text-ink-2">Email</th>
                <th className="px-4 py-3 font-medium text-ink-2">Phone</th>
                <th className="px-4 py-3 font-medium text-ink-2">Loyalty</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 font-medium text-ink">{c.name ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-2">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 font-mono tabular text-ink-2">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 font-mono tabular text-accent-deep">
                    {(c.loyaltyPoints / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
