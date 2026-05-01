/**
 * Products dashboard.
 *
 * Server component: fetches products from the API, renders them in the
 * client TanStack Table. Inline price/stock editing on hover lands once
 * we ship the variants endpoint expansion (W2 follow-up).
 */
import { ExportButton } from '../../../../components/ExportButton';
import { ImportButton } from '../../../../components/ImportButton';
import { ProductsTable } from '../../../../components/ProductsTable';
import { api, type ProductRow } from '../../../../lib/api';

export default async function ProductsPage() {
  let rows: ProductRow[] = [];
  let error: string | null = null;
  try {
    const res = await api<{ products: ProductRow[] }>('/api/v1/products', {
      query: { limit: 200, status: 'all' },
    });
    rows = res.products;
  } catch (err) {
    error = err instanceof Error ? err.message : 'unknown error';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Products</h1>
          <p className="mt-1 text-sm text-ink-2">
            {rows.length} item{rows.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton />
          <ExportButton entity="products" />
        </div>
      </header>
      {error ? (
        <div className="rounded-xl border border-bad bg-surface p-4 text-bad">{error}</div>
      ) : (
        <ProductsTable data={rows} />
      )}
    </div>
  );
}
