/**
 * Imports — CSV ingest for products / customers.
 *
 * In-memory streaming for now. Per master Blueprint §8 step 13, signed-URL
 * upload + background job processing land later. The current shape is the
 * one a streaming pipeline will preserve: parse → validate → insert in a
 * single transaction → return a job-style summary.
 *
 * CSV header conventions match the Square / Shopify export shapes that
 * HANDOFF §3 mobile screen 12 calls out, so a shop coming from one of
 * those can ship their export straight in:
 *
 *   products: name,description,sku,price,category,barcode
 *   customers: name,email,phone
 *
 * Tier-gated (pro / business) — bulk import is a paid feature.
 */
import {
  products,
  variants,
  type Db,
  type NewProduct,
  type NewVariant,
} from '@counter/schema';
import { parse } from 'csv-parse/sync';

import { requireActiveOrg } from '../auth/org.js';
import { requireRole } from '../auth/role.js';
import { requireTier } from '../auth/tier.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

function parsePriceCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export const importRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    ['text/csv', 'application/csv'],
    { parseAs: 'string' },
    (_req, body, done) => done(null, body),
  );

  app.post(
    '/api/v1/imports/products',
    { preHandler: [requireTier(['pro', 'business']), requireRole(['owner', 'manager'])] },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      if (typeof request.body !== 'string' || request.body.trim().length === 0) {
        return reply
          .code(400)
          .send({ error: 'invalid_body', message: 'CSV body required (text/csv).' });
      }

      let rows: Record<string, string>[];
      try {
        rows = parse(request.body, {
          columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        }) as Record<string, string>[];
      } catch (err) {
        return reply
          .code(400)
          .send({ error: 'invalid_csv', message: err instanceof Error ? err.message : 'parse failed' });
      }

      const summary: ImportSummary = { inserted: 0, skipped: 0, errors: [] };
      const db = getDb();

      await db.transaction(async (tx: Db) => {
        for (let i = 0; i < rows.length; i += 1) {
          const row = rows[i] ?? {};
          const rowNumber = i + 2; // header = row 1
          const name = row.name?.trim();
          if (!name) {
            summary.errors.push({ row: rowNumber, message: 'name required' });
            summary.skipped += 1;
            continue;
          }
          const priceCents = parsePriceCents(row.price);
          if (priceCents === null) {
            summary.errors.push({ row: rowNumber, message: 'price required and numeric' });
            summary.skipped += 1;
            continue;
          }

          const productInsert: NewProduct = {
            orgId: org.id,
            name,
            description: row.description?.trim() || null,
          };
          const [insertedProduct] = await tx.insert(products).values(productInsert).returning();
          if (!insertedProduct) {
            summary.errors.push({ row: rowNumber, message: 'insert failed' });
            summary.skipped += 1;
            continue;
          }

          const variantInsert: NewVariant = {
            orgId: org.id,
            productId: insertedProduct.id,
            name: row.variant?.trim() || 'Default',
            sku: row.sku?.trim() || null,
            barcode: row.barcode?.trim() || null,
            priceCents,
          };
          await tx.insert(variants).values(variantInsert);
          summary.inserted += 1;
        }
      });

      return reply.code(200).send(summary);
    },
  );
};
