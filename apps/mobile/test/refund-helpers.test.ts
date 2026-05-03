/**
 * Unit tests for the pure helpers behind the refund flow.
 *
 * Refund math + validation lives in `refund-helpers.ts` so we can pin
 * its contract without booting RN's expo-router / Zustand stack. The
 * blueprint (refund-flow) calls out partial selection, mandatory
 * reason, and the "full vs partial" gate as the surface area to lock
 * down.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampQty,
  computeRefundCents,
  isFullRefund,
  totalSelectedQty,
  validateRefund,
  type RefundableLine,
  type RefundSelection,
} from '../src/state/refund-helpers';

const lines: RefundableLine[] = [
  {
    id: 'item-1',
    variantId: 'var-1',
    nameSnapshot: 'Espresso · Single',
    originalQty: 2,
    unitPriceCents: 350,
  },
  {
    id: 'item-2',
    variantId: 'var-2',
    nameSnapshot: 'Croissant',
    originalQty: 1,
    unitPriceCents: 220,
  },
];

test('clampQty', async (t) => {
  await t.test('clips below zero', () => {
    assert.equal(clampQty(-3, 5), 0);
  });
  await t.test('clips above max', () => {
    assert.equal(clampQty(99, 5), 5);
  });
  await t.test('floors fractional input', () => {
    assert.equal(clampQty(1.7, 5), 1);
  });
  await t.test('rejects NaN as zero', () => {
    assert.equal(clampQty(Number.NaN, 5), 0);
  });
});

test('totalSelectedQty', () => {
  const sel: RefundSelection = { qtyById: { 'item-1': 2, 'item-2': 1 } };
  assert.equal(totalSelectedQty(sel), 3);
  assert.equal(totalSelectedQty({ qtyById: {} }), 0);
});

test('computeRefundCents', async (t) => {
  await t.test('sums qty × unit price across selected lines', () => {
    const sel: RefundSelection = { qtyById: { 'item-1': 1, 'item-2': 1 } };
    assert.equal(computeRefundCents(lines, sel), 350 + 220);
  });
  await t.test('ignores lines absent from selection', () => {
    const sel: RefundSelection = { qtyById: { 'item-1': 2 } };
    assert.equal(computeRefundCents(lines, sel), 700);
  });
  await t.test('zero selection → zero cents', () => {
    assert.equal(computeRefundCents(lines, { qtyById: {} }), 0);
  });
});

test('isFullRefund', async (t) => {
  await t.test('every unit selected → true', () => {
    const sel: RefundSelection = { qtyById: { 'item-1': 2, 'item-2': 1 } };
    assert.equal(isFullRefund(lines, sel), true);
  });
  await t.test('any line short → false', () => {
    const sel: RefundSelection = { qtyById: { 'item-1': 2 } };
    assert.equal(isFullRefund(lines, sel), false);
  });
  await t.test('empty lines → false', () => {
    assert.equal(isFullRefund([], { qtyById: {} }), false);
  });
});

test('validateRefund', async (t) => {
  await t.test('rejects empty selection', () => {
    const v = validateRefund(lines, { qtyById: {} }, 'whatever');
    assert.equal(v.ok, false);
    assert.match(v.reason ?? '', /at least one item/i);
  });
  await t.test('rejects empty reason', () => {
    const sel: RefundSelection = { qtyById: { 'item-1': 1 } };
    assert.equal(validateRefund(lines, sel, '').ok, false);
    assert.equal(validateRefund(lines, sel, '   ').ok, false);
  });
  await t.test('accepts partial refund with reason', () => {
    const sel: RefundSelection = { qtyById: { 'item-2': 1 } };
    assert.equal(validateRefund(lines, sel, 'Customer changed mind').ok, true);
  });
  await t.test('rejects when computed total is zero (zero-priced lines)', () => {
    const free: RefundableLine[] = [
      { id: 'free', variantId: 'v', nameSnapshot: 'Comp', originalQty: 1, unitPriceCents: 0 },
    ];
    const v = validateRefund(free, { qtyById: { free: 1 } }, 'Promo');
    assert.equal(v.ok, false);
  });
});
