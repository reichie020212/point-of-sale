/**
 * useCatalog — observe the local Watermelon catalog and re-emit
 * whenever products or variants change.
 *
 * Subscribes to two query observables (active products + all variants)
 * and joins them in memory keyed on `product.serverId === variant.product_id`.
 * Re-emits whenever either side fires, which means a remote PUSH that
 * lands via the broker fan-out → PULL upsert flows straight into the
 * sell screen with no manual refresh.
 *
 * The shape returned matches what the screen expects: server UUIDs as
 * `id` (not Watermelon's local _id), so the cart/payment flows can
 * keep referring to a single canonical id space.
 */
import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { database } from '../db';

import type { Product as ProductModel } from '../db/models/Product';
import type { Variant as VariantModel } from '../db/models/Variant';

export interface ProductSummary {
  id: string;
  orgId: string;
  categoryId: string | null;
  name: string;
  status: 'active' | 'archived';
}

export interface VariantSummary {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  priceCents: number;
}

export interface CatalogEntry {
  product: ProductSummary;
  variants: VariantSummary[];
}

export function useCatalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const productsCol = database.get<ProductModel>('products');
    const variantsCol = database.get<VariantModel>('variants');

    let products: ProductModel[] = [];
    let variants: VariantModel[] = [];
    let productsSeen = false;
    let variantsSeen = false;

    const recompute = () => {
      const variantsByProductId = new Map<string, VariantModel[]>();
      for (const v of variants) {
        const list = variantsByProductId.get(v.productId);
        if (list) list.push(v);
        else variantsByProductId.set(v.productId, [v]);
      }
      const next = products.map<CatalogEntry>((p) => ({
        product: {
          id: p.serverId,
          orgId: p.orgId,
          categoryId: p.categoryId,
          name: p.name,
          status: p.status as 'active' | 'archived',
        },
        variants: (variantsByProductId.get(p.serverId) ?? []).map<VariantSummary>((v) => ({
          id: v.serverId,
          productId: p.serverId,
          name: v.name,
          sku: v.sku,
          barcode: v.barcode,
          priceCents: v.priceCents,
        })),
      }));
      setEntries(next);
      if (productsSeen && variantsSeen) setLoading(false);
    };

    const productSub = productsCol
      .query(Q.where('status', 'active'))
      .observeWithColumns(['name', 'status'])
      .subscribe((rows) => {
        products = rows;
        productsSeen = true;
        recompute();
      });

    const variantSub = variantsCol
      .query()
      .observeWithColumns(['price_cents', 'name'])
      .subscribe((rows) => {
        variants = rows;
        variantsSeen = true;
        recompute();
      });

    return () => {
      productSub.unsubscribe();
      variantSub.unsubscribe();
    };
  }, []);

  return { entries, loading };
}
