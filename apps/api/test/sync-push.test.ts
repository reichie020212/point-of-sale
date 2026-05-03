/**
 * Sync PUSH integration test (Blueprint: real-push-path).
 *
 * Drives the service directly so the test does not need a live
 * WebSocket client. Persistence is the unit under test; the WS
 * handler is a thin shell over `processPush`.
 *
 * Skips when DATABASE_URL is unreachable (CI provides a service
 * container; contributors without a local Postgres stay green).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  customers,
  inventoryMovements,
  loyaltyPrograms,
  loyaltyPunches,
  orderItems,
  orders,
  organizations,
  products,
  refunds,
  syncIdempotency,
  users,
  variants,
} from '@counter/schema';
import { eq, sql } from 'drizzle-orm';

import { initDb, getDb } from '../src/db.js';
import { processPush, type PushOpInput } from '../src/sync/service.js';

function setEnv() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/counter_test';
  process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_push';
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZGV2LXNpdGUuY2xlcmsuYWNjb3VudHMuZGV2JA';
}

async function dbReachable(): Promise<boolean> {
  setEnv();
  try {
    initDb(process.env.DATABASE_URL!);
    const db = getDb();
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
    ]);
    return true;
  } catch {
    return false;
  }
}

test('sync push', async (t) => {
  if (!(await dbReachable())) {
    t.skip('DATABASE_URL not reachable; skipping sync-push suite (CI runs it).');
    return;
  }

  setEnv();
  const db = getDb();

  // Seed an org and the catalog rows the order will reference. The
  // PUSH path doesn't need the org's user to exist (clerk-bypass not
  // involved), but it does need a real org row + a variant FK.
  const clerkOrgId = `org_test_push_${randomUUID()}`;
  const clerkUserId = `user_test_push_${randomUUID()}`;
  const slug = `counter-push-${randomUUID().slice(0, 8)}`;

  const [org] = await db
    .insert(organizations)
    .values({ clerkOrgId, name: 'Counter Push Test', slug, region: 'US' })
    .returning();
  assert.ok(org);
  const orgId = org.id;

  await db.insert(users).values({
    clerkUserId,
    email: `${clerkUserId}@example.com`,
    activeOrgId: orgId,
  });

  const productId = randomUUID();
  await db.insert(products).values({ id: productId, orgId, name: 'Espresso' });
  const variantSingleId = randomUUID();
  const variantDoubleId = randomUUID();
  await db.insert(variants).values([
    { id: variantSingleId, orgId, productId, name: 'Single', priceCents: 350 },
    { id: variantDoubleId, orgId, productId, name: 'Double', priceCents: 450 },
  ]);

  const cleanup = async () => {
    await db.delete(syncIdempotency).where(eq(syncIdempotency.orgId, orgId));
    await db.delete(loyaltyPunches).where(eq(loyaltyPunches.orgId, orgId));
    await db.delete(loyaltyPrograms).where(eq(loyaltyPrograms.orgId, orgId));
    await db.delete(refunds).where(eq(refunds.orgId, orgId));
    await db.delete(orderItems).where(eq(orderItems.orgId, orgId));
    await db.delete(inventoryMovements).where(eq(inventoryMovements.orgId, orgId));
    await db.delete(orders).where(eq(orders.orgId, orgId));
    await db.delete(customers).where(eq(customers.orgId, orgId));
    await db.delete(variants).where(eq(variants.orgId, orgId));
    await db.delete(products).where(eq(products.orgId, orgId));
    await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  };

  try {
    const orderId = randomUUID();
    const itemSingleId = randomUUID();
    const itemDoubleId = randomUUID();

    const ops: PushOpInput[] = [
      {
        clientOpId: randomUUID(),
        table: 'orders',
        asDelta: false,
        data: {
          id: orderId,
          payment_method: 'cash',
          subtotal_cents: 800,
          total_cents: 800,
        },
      },
      {
        clientOpId: randomUUID(),
        table: 'order_items',
        asDelta: false,
        data: {
          id: itemSingleId,
          order_id: orderId,
          variant_id: variantSingleId,
          name_snapshot: 'Espresso · Single',
          qty: 1,
          unit_price_cents: 350,
          subtotal_cents: 350,
        },
      },
      {
        clientOpId: randomUUID(),
        table: 'order_items',
        asDelta: false,
        data: {
          id: itemDoubleId,
          order_id: orderId,
          variant_id: variantDoubleId,
          name_snapshot: 'Espresso · Double',
          qty: 1,
          unit_price_cents: 450,
          subtotal_cents: 450,
        },
      },
    ];

    await t.test('persists multi-table batch and bumps current_version', async () => {
      const results = await processPush({ db, orgId, ops });
      assert.equal(results.length, 3);
      assert.ok(results.every((r) => r.ok));
      assert.ok(results.every((r) => r.version === '1'));

      const [orgRow] = await db
        .select({ currentVersion: organizations.currentVersion })
        .from(organizations)
        .where(eq(organizations.id, orgId));
      assert.equal(orgRow?.currentVersion, 1n);

      const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
      assert.ok(orderRow);
      assert.equal(orderRow.totalCents, 800);

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      assert.equal(items.length, 2);
    });

    await t.test('replay is idempotent — no new rows, no version bump', async () => {
      const results = await processPush({ db, orgId, ops });
      assert.equal(results.length, 3);
      assert.ok(results.every((r) => r.ok));
      // Replays carry the original record id, but no version (client
      // can PULL to reconcile if it cares).
      assert.equal(results[0]?.id, orderId);
      assert.ok(results.every((r) => r.version === undefined));

      const [orgRow] = await db
        .select({ currentVersion: organizations.currentVersion })
        .from(organizations)
        .where(eq(organizations.id, orgId));
      assert.equal(orgRow?.currentVersion, 1n);

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      assert.equal(items.length, 2);
    });

    await t.test('inventory_movements are append-only with new versions', async () => {
      const movementId = randomUUID();
      const results = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'inventory_movements',
            asDelta: true,
            data: {
              id: movementId,
              variant_id: variantSingleId,
              delta: -1,
              reason: 'sale',
              device_id: 'device-test',
            },
          },
        ],
      });
      assert.equal(results.length, 1);
      assert.equal(results[0]?.ok, true);
      assert.equal(results[0]?.version, '2');

      const [movement] = await db
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.id, movementId));
      assert.ok(movement);
      assert.equal(movement.delta, -1);
    });

    await t.test('partial refund flips order to partially_refunded', async () => {
      const refundId = randomUUID();
      const results = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'refunds',
            asDelta: false,
            data: {
              id: refundId,
              order_id: orderId,
              amount_cents: 350, // partial — order total was 800
              reason: 'Customer changed mind',
            },
          },
        ],
      });
      assert.equal(results.length, 1);
      assert.equal(results[0]?.ok, true);

      const [refundRow] = await db.select().from(refunds).where(eq(refunds.id, refundId));
      assert.ok(refundRow);
      assert.equal(refundRow.amountCents, 350);

      const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
      assert.equal(orderRow?.status, 'partially_refunded');
    });

    await t.test('full refund (cumulative) flips order to refunded', async () => {
      const secondRefundId = randomUUID();
      const results = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'refunds',
            asDelta: false,
            data: {
              id: secondRefundId,
              order_id: orderId,
              amount_cents: 450, // 350 + 450 = 800 = order total
              reason: 'Returned remaining drink',
            },
          },
        ],
      });
      assert.equal(results[0]?.ok, true);

      const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
      assert.equal(orderRow?.status, 'refunded');
    });

    await t.test('tipped-order partial refund persists breakdown columns', async () => {
      // Tipped/taxed order: 1000 + 120 tax + 50 tip = 1170 total. The
      // mobile client computes the breakdown locally (Blueprint:
      // tip-allocation-on-partial-refunds) and ships all four
      // component fields — the server stores them verbatim.
      const tippedOrderId = randomUUID();
      const tippedItemId = randomUUID();
      await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'orders',
            asDelta: false,
            data: {
              id: tippedOrderId,
              payment_method: 'cash',
              subtotal_cents: 1000,
              tax_cents: 120,
              tip_cents: 50,
              discount_cents: 0,
              total_cents: 1170,
            },
          },
          {
            clientOpId: randomUUID(),
            table: 'order_items',
            asDelta: false,
            data: {
              id: tippedItemId,
              order_id: tippedOrderId,
              variant_id: variantSingleId,
              name_snapshot: 'Single ×2',
              qty: 2,
              unit_price_cents: 500,
              subtotal_cents: 1000,
            },
          },
        ],
      });

      // Partial refund: half the items. Tip stays at 0 (all-or-nothing
      // rule); tax pro-rated to floor(120 × 500/1000) = 60.
      const partialRefundId = randomUUID();
      await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'refunds',
            asDelta: false,
            data: {
              id: partialRefundId,
              order_id: tippedOrderId,
              amount_cents: 560,
              subtotal_cents: 500,
              tax_cents: 60,
              tip_cents: 0,
              discount_cents: 0,
              reason: 'One drink wrong',
            },
          },
        ],
      });
      const [partialRow] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, partialRefundId));
      assert.ok(partialRow);
      assert.equal(partialRow.subtotalCents, 500);
      assert.equal(partialRow.taxCents, 60);
      assert.equal(partialRow.tipCents, 0, 'tip must stay at 0 on partial refund');
      assert.equal(partialRow.discountCents, 0);
      assert.equal(partialRow.amountCents, 560);

      const [afterPartial] = await db.select().from(orders).where(eq(orders.id, tippedOrderId));
      assert.equal(afterPartial?.status, 'partially_refunded');

      // Closing-out refund: remaining items, plus the held tip + tax
      // remainder. Σ refunds.amount_cents = 560 + 610 = 1170 =
      // order.total_cents → status flips to refunded.
      const closingRefundId = randomUUID();
      await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'refunds',
            asDelta: false,
            data: {
              id: closingRefundId,
              order_id: tippedOrderId,
              amount_cents: 610,
              subtotal_cents: 500,
              tax_cents: 60,
              tip_cents: 50,
              discount_cents: 0,
              reason: 'Returned the rest',
            },
          },
        ],
      });
      const [closingRow] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, closingRefundId));
      assert.equal(closingRow?.tipCents, 50, 'closing-out releases the full tip');

      const [afterClosing] = await db.select().from(orders).where(eq(orders.id, tippedOrderId));
      assert.equal(
        afterClosing?.status,
        'refunded',
        'order must flip to refunded once cumulative refund matches order.total_cents (incl. tip)',
      );
    });

    await t.test('refund with bad order_id rejected as invalid_payload', async () => {
      const results = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'refunds',
            asDelta: false,
            data: {
              id: randomUUID(),
              order_id: randomUUID(), // not an existing order
              amount_cents: 100,
            },
          },
        ],
      });
      assert.equal(results[0]?.ok, false);
      assert.match(results[0]?.error ?? '', /invalid_payload/);
    });

    await t.test('loyalty: program upsert + earned + redemption punches persist', async () => {
      const programId = randomUUID();
      // Need a customer to attach punches to.
      const customerId = randomUUID();
      await db
        .insert(customers)
        .values({ id: customerId, orgId, name: 'Loyalty Test' });

      const programResults = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'loyalty_programs',
            asDelta: false,
            data: {
              id: programId,
              name: 'Coffee Card',
              target_type: 'product',
              target_id: productId,
              threshold: 5,
            },
          },
        ],
      });
      assert.equal(programResults[0]?.ok, true);

      const earnedId = randomUUID();
      const redemptionId = randomUUID();
      const punchResults = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'loyalty_punches',
            asDelta: false,
            data: {
              id: earnedId,
              customer_id: customerId,
              program_id: programId,
              order_item_id: 'item-1',
              is_redemption: false,
            },
          },
          {
            clientOpId: randomUUID(),
            table: 'loyalty_punches',
            asDelta: false,
            data: {
              id: redemptionId,
              customer_id: customerId,
              program_id: programId,
              order_item_id: 'item-2',
              is_redemption: true,
            },
          },
        ],
      });
      assert.equal(punchResults.filter((r) => r.ok).length, 2);

      const earnedRows = await db
        .select()
        .from(loyaltyPunches)
        .where(eq(loyaltyPunches.programId, programId));
      assert.equal(earnedRows.length, 2);
      assert.equal(
        earnedRows.filter((r: { isRedemption: boolean }) => r.isRedemption).length,
        1,
      );
    });

    await t.test('refund tombstones associated loyalty_punches', async () => {
      // Build an isolated mini-order for this case so prior subtests
      // (which already left the original order fully refunded) don't
      // interfere. New order, new customer, new program, three punches
      // attached to the new order's items, then refund and confirm
      // tombstones.
      const refundOrderId = randomUUID();
      const refundCustomerId = randomUUID();
      const refundProgramId = randomUUID();

      await db.insert(customers).values({ id: refundCustomerId, orgId, name: 'Refund-Loyalty' });
      const programResults = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'loyalty_programs',
            asDelta: false,
            data: {
              id: refundProgramId,
              name: 'Test',
              target_type: 'product',
              target_id: productId,
              threshold: 5,
            },
          },
        ],
      });
      assert.equal(programResults[0]?.ok, true);

      const orderResults = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'orders',
            asDelta: false,
            data: {
              id: refundOrderId,
              payment_method: 'cash',
              subtotal_cents: 700,
              total_cents: 700,
            },
          },
        ],
      });
      assert.equal(orderResults[0]?.ok, true);

      const punchA = randomUUID();
      const punchB = randomUUID();
      const unrelatedPunch = randomUUID();
      const unrelatedOrderId = randomUUID();
      await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'loyalty_punches',
            asDelta: false,
            data: {
              id: punchA,
              customer_id: refundCustomerId,
              program_id: refundProgramId,
              order_item_id: `${refundOrderId}_lineA`,
              is_redemption: false,
            },
          },
          {
            clientOpId: randomUUID(),
            table: 'loyalty_punches',
            asDelta: false,
            data: {
              id: punchB,
              customer_id: refundCustomerId,
              program_id: refundProgramId,
              order_item_id: `${refundOrderId}_lineB`,
              is_redemption: false,
            },
          },
          {
            clientOpId: randomUUID(),
            table: 'loyalty_punches',
            asDelta: false,
            data: {
              id: unrelatedPunch,
              customer_id: refundCustomerId,
              program_id: refundProgramId,
              order_item_id: `${unrelatedOrderId}_lineX`,
              is_redemption: false,
            },
          },
        ],
      });

      const refundResults = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'refunds',
            asDelta: false,
            data: {
              id: randomUUID(),
              order_id: refundOrderId,
              amount_cents: 700,
              reason: 'Returned',
            },
          },
        ],
      });
      assert.equal(refundResults[0]?.ok, true);

      const [a] = await db.select().from(loyaltyPunches).where(eq(loyaltyPunches.id, punchA));
      const [b] = await db.select().from(loyaltyPunches).where(eq(loyaltyPunches.id, punchB));
      const [u] = await db
        .select()
        .from(loyaltyPunches)
        .where(eq(loyaltyPunches.id, unrelatedPunch));
      assert.ok(a?.deletedAt, 'punch A should be tombstoned');
      assert.ok(b?.deletedAt, 'punch B should be tombstoned');
      assert.equal(u?.deletedAt, null, 'unrelated-order punch must NOT be tombstoned');
    });

    await t.test('loyalty_programs missing target_id rejected as invalid_payload', async () => {
      const results = await processPush({
        db,
        orgId,
        ops: [
          {
            clientOpId: randomUUID(),
            table: 'loyalty_programs',
            asDelta: false,
            data: {
              id: randomUUID(),
              name: 'Bad',
              target_type: 'product',
              // target_id missing
              threshold: 5,
            },
          },
        ],
      });
      assert.equal(results[0]?.ok, false);
      assert.match(results[0]?.error ?? '', /invalid_payload/);
    });
  } finally {
    await cleanup();
  }
});
