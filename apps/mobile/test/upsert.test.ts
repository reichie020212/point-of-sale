/**
 * Unit test for the PULL upsert.
 *
 * Mocks Watermelon's Database/Collection/Model surface so we can run
 * under plain Node — the real SQLiteAdapter only exists on a device.
 *
 * Asserts the four cases from the Blueprint:
 *   1. record exists + alive   → prepareUpdate
 *   2. record missing + alive  → prepareCreate
 *   3. record exists + tombstoned → prepareDestroyPermanently
 *   4. record missing + tombstoned → no-op
 *
 * Plus column allowlisting (server emits an unknown column → it is
 * dropped, not stored locally).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { applyServerChanges } from '../src/sync/upsert';

import type { Database, Model } from '@nozbe/watermelondb';

interface FakeRow {
  _raw: Record<string, unknown>;
  /** Track which prepare* method was called for assertions. */
  _action?: 'update' | 'destroy';
}

class FakeCollection {
  constructor(public readonly existing: FakeRow[]) {}

  query(): { fetch: () => Promise<FakeRow[]> } {
    return { fetch: async () => this.existing };
  }

  prepareCreate(fn: (row: FakeRow) => void): FakeRow {
    const row: FakeRow = { _raw: {} };
    fn(row);
    return row;
  }
}

function fakeDatabase(table: string, existing: FakeRow[]) {
  const collection = new FakeCollection(existing);
  const writes: { batch: FakeRow[] }[] = [];
  const db = {
    get: (t: string) => {
      assert.equal(t, table);
      return collection;
    },
    write: async (fn: () => Promise<void>) => fn(),
    batch: async (...actions: FakeRow[]) => {
      writes.push({ batch: actions });
    },
  } as unknown as Database;
  return { db, writes, collection };
}

function makeExisting(serverId: string): FakeRow {
  const row: FakeRow = { _raw: { server_id: serverId, name: 'old' } };
  // Bind prepareUpdate / prepareDestroyPermanently to mutate the row.
  Object.assign(row, {
    prepareUpdate(fn: (m: FakeRow) => void) {
      fn(row);
      row._action = 'update';
      return row;
    },
    prepareDestroyPermanently() {
      row._action = 'destroy';
      return row;
    },
  });
  return row;
}

test('creates a missing alive record', async () => {
  const { db, writes, collection } = fakeDatabase('products', []);
  await applyServerChanges({
    database: db,
    table: 'products',
    records: [{ id: 'srv-1', name: 'Espresso', org_id: 'org-1' }],
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.batch.length, 1);
  const created = writes[0]!.batch[0]!;
  assert.equal(created._raw.server_id, 'srv-1');
  assert.equal(created._raw.name, 'Espresso');
  assert.equal(created._raw.org_id, 'org-1');
  // Existing collection untouched.
  assert.equal(collection.existing.length, 0);
});

test('updates an existing alive record', async () => {
  const existing = makeExisting('srv-2');
  const { db, writes } = fakeDatabase('products', [existing]);
  await applyServerChanges({
    database: db,
    table: 'products',
    records: [{ id: 'srv-2', name: 'Latte', org_id: 'org-1' }],
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.batch.length, 1);
  assert.equal(existing._action, 'update');
  assert.equal(existing._raw.name, 'Latte');
});

test('destroys an existing tombstoned record', async () => {
  const existing = makeExisting('srv-3');
  const { db, writes } = fakeDatabase('products', [existing]);
  await applyServerChanges({
    database: db,
    table: 'products',
    records: [{ id: 'srv-3', name: 'Latte', deleted_at: '2026-05-02T00:00:00Z' }],
  });
  assert.equal(writes.length, 1);
  assert.equal(existing._action, 'destroy');
});

test('skips a missing tombstoned record (no batch)', async () => {
  const { db, writes } = fakeDatabase('products', []);
  await applyServerChanges({
    database: db,
    table: 'products',
    records: [{ id: 'srv-4', deleted_at: '2026-05-02T00:00:00Z' }],
  });
  assert.equal(writes.length, 0);
});

test('drops columns not in the allowlist', async () => {
  const { db, writes } = fakeDatabase('products', []);
  await applyServerChanges({
    database: db,
    table: 'products',
    records: [
      {
        id: 'srv-5',
        name: 'Mocha',
        // Unknown / server-only field — must not land in _raw.
        version: '99',
        cashier_id: 'cashier-1',
      },
    ],
  });
  const created = writes[0]!.batch[0]!;
  assert.equal(created._raw.name, 'Mocha');
  assert.equal('version' in created._raw, false);
  assert.equal('cashier_id' in created._raw, false);
});

test('coerces ISO timestamps to milliseconds', async () => {
  const { db, writes } = fakeDatabase('products', []);
  await applyServerChanges({
    database: db,
    table: 'products',
    records: [{ id: 'srv-6', name: 'Drip', updated_at: '2026-05-02T12:34:56.000Z' }],
  });
  const created = writes[0]!.batch[0]!;
  assert.equal(typeof created._raw.updated_at, 'number');
  assert.equal(created._raw.updated_at, Date.parse('2026-05-02T12:34:56.000Z'));
});

test('refunds is a no-op (not yet mirrored locally)', async () => {
  const { db, writes } = fakeDatabase('refunds', []);
  await applyServerChanges({
    database: db,
    table: 'refunds',
    records: [{ id: 'srv-7' }],
  });
  assert.equal(writes.length, 0);
});

test('drops camelCase keys (bug-shape sentinel for the snake_case allowlist)', async () => {
  const { db, writes } = fakeDatabase('products', []);
  // Pre-fix, the API serializer emitted Drizzle's camelCase JS keys
  // (orgId, updatedAt, priceCents). The snake_case allowlist filtered
  // them all out, leaving only id + deleted_at on the local row. This
  // test pins that filter so a regression on the server side (a
  // payload reverting to camelCase) wouldn't pass undetected — the
  // assertion below would still hold and the API serializer test
  // would fail first.
  await applyServerChanges({
    database: db,
    table: 'products',
    records: [
      {
        id: 'srv-bug-shape',
        orgId: 'should-be-dropped',
        categoryId: 'also-dropped',
        name: 'Mocha', // already snake_case-equivalent at top level
      },
    ],
  });
  const created = writes[0]!.batch[0]!;
  assert.equal(created._raw.server_id, 'srv-bug-shape');
  assert.equal(created._raw.name, 'Mocha');
  assert.equal('orgId' in created._raw, false);
  assert.equal('org_id' in created._raw, false);
  assert.equal('categoryId' in created._raw, false);
  assert.equal('category_id' in created._raw, false);
});

test('multiple records batched in one write', async () => {
  const existing = makeExisting('srv-9');
  const { db, writes } = fakeDatabase('products', [existing]);
  await applyServerChanges({
    database: db,
    table: 'products',
    records: [
      { id: 'srv-9', name: 'Updated' },
      { id: 'srv-10', name: 'New' },
    ],
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.batch.length, 2);
  assert.equal(existing._action, 'update');
});
