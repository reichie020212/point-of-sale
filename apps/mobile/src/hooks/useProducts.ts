/**
 * Lightweight data hooks. The serious answer in M6 is to read from
 * WatermelonDB and let the sync engine refill the local copy. M5 ships
 * a direct-fetch placeholder so the catalog screen has something real
 * to render against the dev API.
 */
import { useEffect, useState } from 'react';

import { ApiError, apiCalls, type ProductSummary, type VariantSummary } from '../api/client';

export interface CatalogEntry {
  product: ProductSummary;
  variants: VariantSummary[];
}

export function useCatalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await apiCalls.listProducts({ limit: 100 });
        const detailed = await Promise.all(
          list.products.map(async (p) => {
            const detail = await apiCalls.getProduct(p.id);
            return { product: detail.product, variants: detail.variants };
          }),
        );
        if (!cancelled) {
          setEntries(detailed);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
        else setError(err instanceof Error ? err.message : 'unknown');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { entries, error, loading };
}
