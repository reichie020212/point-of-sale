/**
 * Loyalty programs dashboard.
 *
 * Lists active programs and provides the create/archive client widget.
 * Programs are sync-replicated — mobile registers pick up new programs
 * on the next PULL (typically the next reconnect).
 */
import { LoyaltyAdmin } from '../../../../components/LoyaltyAdmin';
import { api } from '../../../../lib/api';

interface ProgramRow {
  id: string;
  name: string;
  targetType: 'product' | 'category';
  targetId: string;
  threshold: number;
  status: 'active' | 'archived';
}

interface CategoryRow {
  id: string;
  name: string;
}

interface ProductRow {
  id: string;
  name: string;
}

export default async function LoyaltyPage() {
  let programs: ProgramRow[] = [];
  let categories: CategoryRow[] = [];
  let products: ProductRow[] = [];
  let error: string | null = null;
  try {
    const [progRes, catRes, prodRes] = await Promise.all([
      api<{ programs: ProgramRow[] }>('/api/v1/loyalty/programs'),
      api<{ categories: CategoryRow[] }>('/api/v1/categories'),
      api<{ products: ProductRow[] }>('/api/v1/products', {
        query: { limit: 200, status: 'active' },
      }),
    ]);
    programs = progRes.programs;
    categories = catRes.categories;
    products = prodRes.products;
  } catch (err) {
    error = err instanceof Error ? err.message : 'unknown error';
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Loyalty</h1>
        <p className="mt-1 text-sm text-ink-2">
          Punchcard programs. Buy N qualifying items, get the next one free.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-bad bg-surface p-4 text-bad">{error}</div>
      ) : (
        <LoyaltyAdmin programs={programs} categories={categories} products={products} />
      )}
    </div>
  );
}
