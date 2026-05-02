/**
 * Exports — CSV / JSON dumps for products / customers / orders.
 *
 * "Your data is yours" (HANDOFF non-negotiable #6) is delivered here.
 * Free + paid tiers both get exports. (Tier gating only applies to
 * sync, reports, and devices; exports stay free.)
 *
 * Storage: writes to /tmp/counter-exports/{uuid}.{ext} for local dev
 * and returns a `file://` URL. The signed-URL S3 path lives in
 * apps/api/src/storage and lands once object storage is wired
 * (HANDOFF §6 / TODO).
 */
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { customers, orders, products, variants } from '@counter/schema';
import { stringify } from 'csv-stringify/sync';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { requireActiveOrg } from '../auth/org.js';
import { requireRole } from '../auth/role.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';

const ExportBody = z.object({
  entity: z.enum(['products', 'customers', 'orders']),
  format: z.enum(['csv', 'json']).default('csv'),
});

interface ExportRow {
  [key: string]: string | number | null;
}

const EXPORT_DIR = join(tmpdir(), 'counter-exports');

interface ProductExportRow {
  name: string;
  description: string | null;
  status: string;
  variantName: string | null;
  sku: string | null;
  barcode: string | null;
  priceCents: number | null;
}

async function loadProducts(orgId: string): Promise<ExportRow[]> {
  const db = getDb();
  const rows: ProductExportRow[] = await db
    .select({
      name: products.name,
      description: products.description,
      status: products.status,
      variantName: variants.name,
      sku: variants.sku,
      barcode: variants.barcode,
      priceCents: variants.priceCents,
    })
    .from(products)
    .leftJoin(variants, eq(variants.productId, products.id))
    .where(and(eq(products.orgId, orgId), isNull(products.deletedAt)))
    .orderBy(asc(products.name));
  return rows.map((r) => ({
    name: r.name,
    description: r.description,
    sku: r.sku,
    price: r.priceCents == null ? null : (r.priceCents / 100).toFixed(2),
    variant: r.variantName,
    barcode: r.barcode,
    status: r.status,
  }));
}

async function loadCustomers(orgId: string): Promise<ExportRow[]> {
  const db = getDb();
  const rows: (typeof customers.$inferSelect)[] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.orgId, orgId), isNull(customers.deletedAt)))
    .orderBy(asc(customers.createdAt));
  return rows.map((r) => ({
    name: r.name,
    email: r.email,
    phone: r.phone,
    loyaltyPoints: r.loyaltyPoints,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function loadOrders(orgId: string): Promise<ExportRow[]> {
  const db = getDb();
  const rows: (typeof orders.$inferSelect)[] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orgId, orgId), isNull(orders.deletedAt)))
    .orderBy(asc(orders.createdAt));
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    paymentMethod: r.paymentMethod,
    subtotal: (r.subtotalCents / 100).toFixed(2),
    tax: (r.taxCents / 100).toFixed(2),
    tip: (r.tipCents / 100).toFixed(2),
    discount: (r.discountCents / 100).toFixed(2),
    total: (r.totalCents / 100).toFixed(2),
    createdAt: r.createdAt.toISOString(),
  }));
}

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/v1/exports',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const parsed = ExportBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const { entity, format } = parsed.data;

      const rows =
        entity === 'products'
          ? await loadProducts(org.id)
          : entity === 'customers'
            ? await loadCustomers(org.id)
            : await loadOrders(org.id);

      await mkdir(EXPORT_DIR, { recursive: true });
      const fileId = randomUUID();
      const filename = `${entity}-${fileId}.${format}`;
      const filePath = join(EXPORT_DIR, filename);
      const body =
        format === 'csv' ? stringify(rows, { header: true }) : JSON.stringify(rows, null, 2);
      await writeFile(filePath, body, 'utf8');

      return reply.send({
        url: `/api/v1/exports/${fileId}.${format}`,
        filename,
        rows: rows.length,
        bytes: Buffer.byteLength(body, 'utf8'),
      });
    },
  );

  app.get<{ Params: { file: string } }>('/api/v1/exports/:file', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    if (!/^[a-f0-9-]{36}\.(csv|json)$/.test(request.params.file)) {
      return reply.code(400).send({ error: 'invalid_filename' });
    }
    const filePath = join(EXPORT_DIR, request.params.file);
    if (!filePath.startsWith(EXPORT_DIR) || !existsSync(filePath)) {
      return reply.code(404).send({ error: 'not_found' });
    }
    const isCsv = request.params.file.endsWith('.csv');
    reply.header('content-type', isCsv ? 'text/csv; charset=utf-8' : 'application/json');
    reply.header('content-disposition', `attachment; filename="${request.params.file}"`);
    return reply.send(createReadStream(filePath));
  });
};
