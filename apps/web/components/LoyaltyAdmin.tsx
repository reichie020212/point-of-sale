'use client';

/**
 * Loyalty programs admin widget.
 *
 * Lists existing programs and lets the owner/manager create a new one
 * targeting a product or a category, with a configurable threshold.
 * Archive is a soft delete that the API converts to status='archived'.
 *
 * The default form state matches Gemini's Blueprint preset: "Buy 9 of
 * the first available category, get the 10th free."
 */
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

interface Props {
  programs: ProgramRow[];
  categories: CategoryRow[];
  products: ProductRow[];
}

export function LoyaltyAdmin({ programs, categories, products }: Props) {
  const router = useRouter();
  const { getToken } = useAuth();

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const [name, setName] = useState('Coffee Card');
  const [targetType, setTargetType] = useState<'product' | 'category'>('category');
  const [targetId, setTargetId] = useState<string>(categories[0]?.id ?? products[0]?.id ?? '');
  const [threshold, setThreshold] = useState(9);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetOptions = targetType === 'product' ? products : categories;

  async function call(path: string, init: RequestInit) {
    const token = await getToken();
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok && res.status !== 204) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `request failed (${res.status})`);
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!targetId) {
      setError('Pick a product or category');
      return;
    }
    setBusy(true);
    try {
      await call('/api/v1/loyalty/programs', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), targetType, targetId, threshold }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'create failed');
    } finally {
      setBusy(false);
    }
  }

  async function onArchive(id: string) {
    setError(null);
    setBusy(true);
    try {
      await call(`/api/v1/loyalty/programs/${id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'archive failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">New program</h2>
        <form onSubmit={onCreate} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="block text-xs text-ink-3">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              className="mt-1 block w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-ink outline-none focus:border-accent-deep"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-3">Threshold</span>
            <input
              type="number"
              min={1}
              max={999}
              value={threshold}
              onChange={(e) => setThreshold(Number.parseInt(e.target.value, 10) || 1)}
              required
              className="mt-1 block w-full rounded-lg border border-line-2 bg-surface px-3 py-2 font-mono tabular text-ink outline-none focus:border-accent-deep"
            />
            <span className="mt-1 block text-xs text-ink-3">
              Buy this many to earn the next one free.
            </span>
          </label>
          <label className="block">
            <span className="block text-xs text-ink-3">Target type</span>
            <select
              value={targetType}
              onChange={(e) => {
                const next = e.target.value as 'product' | 'category';
                setTargetType(next);
                setTargetId((next === 'product' ? products[0]?.id : categories[0]?.id) ?? '');
              }}
              className="mt-1 block w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-ink outline-none focus:border-accent-deep"
            >
              <option value="category">Category</option>
              <option value="product">Product</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-ink-3">
              {targetType === 'product' ? 'Product' : 'Category'}
            </span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
              disabled={targetOptions.length === 0}
              className="mt-1 block w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-ink outline-none focus:border-accent-deep disabled:opacity-60"
            >
              {targetOptions.length === 0 ? (
                <option value="">No {targetType}s yet</option>
              ) : (
                targetOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))
              )}
            </select>
          </label>
          {error && (
            <p className="md:col-span-2 text-sm text-bad" role="alert">
              {error}
            </p>
          )}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={busy || !targetId}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg hover:bg-ink-2 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Create program'}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Active programs</h2>
        {programs.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line-2 bg-surface p-12 text-center text-ink-3">
            No loyalty programs yet. Create one above.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-ink-2">Name</th>
                  <th className="px-4 py-3 font-medium text-ink-2">Target</th>
                  <th className="px-4 py-3 font-medium text-ink-2">Threshold</th>
                  <th className="px-4 py-3 font-medium text-ink-2">Status</th>
                  <th className="px-4 py-3 font-medium text-ink-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => {
                  const targetName =
                    p.targetType === 'product'
                      ? productById.get(p.targetId)
                      : categoryById.get(p.targetId);
                  return (
                    <tr key={p.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                      <td className="px-4 py-3 text-ink-2">
                        {p.targetType === 'product' ? 'Product: ' : 'Category: '}
                        {targetName ?? <span className="text-ink-3">(deleted)</span>}
                      </td>
                      <td className="px-4 py-3 font-mono tabular text-ink">{p.threshold}</td>
                      <td className="px-4 py-3 text-ink-2">{p.status}</td>
                      <td className="px-4 py-3 text-right">
                        {p.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => {
                              void onArchive(p.id);
                            }}
                            disabled={busy}
                            className="text-sm text-bad hover:underline disabled:opacity-50"
                          >
                            Archive
                          </button>
                        ) : (
                          <span className="text-xs text-ink-3">Archived</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
