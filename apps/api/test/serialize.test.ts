/**
 * Unit test for the sync wire serializer.
 *
 * The mobile client's `applyServerChanges` allowlist is snake_case
 * (org_id, price_cents) but Drizzle returns camelCase JS keys
 * (orgId, priceCents). `serializeRow` is the boundary that converts
 * — without it, cross-device PULL silently drops every column
 * except the ones whose JS and DB names happen to match (id,
 * deleted_at).
 *
 * This test pins the contract.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeRow, toSnakeCase } from '../src/util/serialize.js';

test('toSnakeCase', async (t) => {
  await t.test('camelCase → snake_case', () => {
    assert.equal(toSnakeCase('orgId'), 'org_id');
    assert.equal(toSnakeCase('priceCents'), 'price_cents');
    assert.equal(toSnakeCase('clientOpId'), 'client_op_id');
    assert.equal(toSnakeCase('lastSeenVersion'), 'last_seen_version');
  });

  await t.test('idempotent on already-snake_case input', () => {
    assert.equal(toSnakeCase('id'), 'id');
    assert.equal(toSnakeCase('org_id'), 'org_id');
    assert.equal(toSnakeCase('deleted_at'), 'deleted_at');
    assert.equal(toSnakeCase('modifiers_json'), 'modifiers_json');
  });

  await t.test('preserves digits inside identifiers', () => {
    assert.equal(toSnakeCase('s3Url'), 's3_url');
    assert.equal(toSnakeCase('iso4217Code'), 'iso4217_code');
  });
});

test('serializeRow', async (t) => {
  await t.test('renames camelCase keys to snake_case', () => {
    const out = serializeRow({
      id: 'srv-1',
      orgId: 'org-1',
      categoryId: 'cat-1',
      priceCents: 350,
      name: 'Espresso',
    });
    assert.equal(out.id, 'srv-1');
    assert.equal(out.org_id, 'org-1');
    assert.equal(out.category_id, 'cat-1');
    assert.equal(out.price_cents, 350);
    assert.equal(out.name, 'Espresso');
    // Bug-shape: no leftover camelCase keys.
    assert.equal('orgId' in out, false);
    assert.equal('priceCents' in out, false);
    assert.equal('categoryId' in out, false);
  });

  await t.test('bigint → decimal string', () => {
    const out = serializeRow({ version: 42n, currentVersion: 1234567890123n });
    assert.equal(out.version, '42');
    assert.equal(out.current_version, '1234567890123');
  });

  await t.test('Date → ISO string', () => {
    const at = new Date('2026-05-03T12:34:56.000Z');
    const out = serializeRow({ updatedAt: at, deletedAt: null });
    assert.equal(out.updated_at, '2026-05-03T12:34:56.000Z');
    assert.equal(out.deleted_at, null);
  });

  await t.test('passes through scalars and JSONB blobs untouched', () => {
    const blob = [{ name: 'oat', priceCents: 50 }];
    const out = serializeRow({
      modifiersJson: blob,
      qty: 2,
      isVoid: false,
      note: null,
    });
    assert.deepEqual(out.modifiers_json, blob);
    assert.equal(out.qty, 2);
    assert.equal(out.is_void, false);
    assert.equal(out.note, null);
  });

  await t.test('idempotent on already-snake_case rows', () => {
    const out = serializeRow({
      id: 'srv-2',
      org_id: 'org-2',
      deleted_at: null,
    });
    assert.deepEqual(out, { id: 'srv-2', org_id: 'org-2', deleted_at: null });
  });
});
