/**
 * Products + variants + modifiers.
 *
 * Product CRUD with cursor pagination (HANDOFF §3 calls for virtualized
 * lists supporting 10k+ SKUs). Variants and modifiers ride along: a
 * GET /api/v1/products/:id returns the product with its variants and
 * modifiers in a single round trip; create/update accepts them inline.
 *
 * Soft delete is the only delete: setting `deletedAt` lets sync push
 * tombstones to offline devices for 30 days.
 */
import { modifiers, products, variants } from '@counter/schema';
import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { requireActiveOrg } from '../auth/org.js';
import { requireRole } from '../auth/role.js';
import { getDb } from '../db.js';

import type { FastifyPluginAsync } from 'fastify';


const VariantInput = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().max(40).optional(),
  barcode: z.string().trim().max(40).optional(),
  priceCents: z.number().int().nonnegative(),
});

const ModifierInput = z.object({
  name: z.string().trim().min(1).max(60),
  priceCents: z.number().int().default(0),
  multiSelect: z.number().int().nonnegative().default(0),
});

const CreateProductBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  imagePath: z.string().trim().max(400).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['active', 'archived']).default('active'),
  variants: z.array(VariantInput).min(1, 'at least one variant required'),
  modifiers: z.array(ModifierInput).default([]),
});

const PatchProductBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  imagePath: z.string().trim().max(400).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

const ListQuery = z.object({
  categoryId: z.string().uuid().optional(),
  status: z.enum(['active', 'archived', 'all']).default('active'),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/products', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const parsedQuery = ListQuery.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.code(400).send({ error: 'invalid_query', issues: parsedQuery.error.issues });
    }
    const { categoryId, status, cursor, limit } = parsedQuery.data;
    const db = getDb();

    const conditions = [eq(products.orgId, org.id), isNull(products.deletedAt)];
    if (categoryId) conditions.push(eq(products.categoryId, categoryId));
    if (status !== 'all') conditions.push(eq(products.status, status));
    if (cursor) conditions.push(gt(products.id, cursor));

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(asc(products.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return reply.send({
      products: page,
      nextCursor: hasMore && last ? last.id : null,
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/products/:id', async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const db = getDb();
    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, request.params.id),
          eq(products.orgId, org.id),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (!product) return reply.code(404).send({ error: 'not_found' });

    const productVariants = await db
      .select()
      .from(variants)
      .where(
        and(
          eq(variants.productId, product.id),
          eq(variants.orgId, org.id),
          isNull(variants.deletedAt),
        ),
      )
      .orderBy(asc(variants.name));

    const productModifiers = await db
      .select()
      .from(modifiers)
      .where(
        and(
          eq(modifiers.productId, product.id),
          eq(modifiers.orgId, org.id),
          isNull(modifiers.deletedAt),
        ),
      )
      .orderBy(asc(modifiers.name));

    return reply.send({
      product,
      variants: productVariants,
      modifiers: productModifiers,
    });
  });

  app.post('/api/v1/products', { preHandler: requireRole(['owner', 'manager']) }, async (request, reply) => {
    const org = await requireActiveOrg(request, reply);
    if (!org) return;
    const parsed = CreateProductBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const { variants: variantInputs, modifiers: modifierInputs, ...productInput } = parsed.data;
    const db = getDb();

    // tx has the same query surface as db; the explicit annotation here
    // works around a Drizzle type-inference quirk where the spread schema
    // in packages/schema/src/db.ts loses generics in the transaction callback.
    const result = await db.transaction(async (tx: typeof db) => {
      const insertedProducts = await tx
        .insert(products)
        .values({ orgId: org.id, ...productInput })
        .returning();
      const product = insertedProducts[0];
      if (!product) throw new Error('product insert returned no rows');

      const insertedVariants = await tx
        .insert(variants)
        .values(
          variantInputs.map((v) => ({
            orgId: org.id,
            productId: product.id,
            ...v,
          })),
        )
        .returning();

      const insertedModifiers = modifierInputs.length
        ? await tx
            .insert(modifiers)
            .values(
              modifierInputs.map((m) => ({
                orgId: org.id,
                productId: product.id,
                ...m,
              })),
            )
            .returning()
        : [];

      return { product, variants: insertedVariants, modifiers: insertedModifiers };
    });

    return reply.code(201).send(result);
  });

  app.patch<{ Params: { id: string } }>(
    '/api/v1/products/:id',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const parsed = PatchProductBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const db = getDb();
      const updated = await db
        .update(products)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(
          and(
            eq(products.id, request.params.id),
            eq(products.orgId, org.id),
            isNull(products.deletedAt),
          ),
        )
        .returning();
      const row = updated[0];
      if (!row) return reply.code(404).send({ error: 'not_found' });
      return reply.send({ product: row });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/products/:id',
    { preHandler: requireRole(['owner', 'manager']) },
    async (request, reply) => {
      const org = await requireActiveOrg(request, reply);
      if (!org) return;
      const db = getDb();
      const now = new Date();
      const updated = await db
        .update(products)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(products.id, request.params.id),
            eq(products.orgId, org.id),
            isNull(products.deletedAt),
          ),
        )
        .returning({ id: products.id });
      if (updated.length === 0) return reply.code(404).send({ error: 'not_found' });
      // Cascade tombstone to variants + modifiers so sync sees them.
      await db
        .update(variants)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(variants.productId, request.params.id), isNull(variants.deletedAt)));
      await db
        .update(modifiers)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(modifiers.productId, request.params.id), isNull(modifiers.deletedAt)));
      return reply.code(204).send();
    },
  );

  void desc; // referenced once we add cursor reverse-paging in W7
};
