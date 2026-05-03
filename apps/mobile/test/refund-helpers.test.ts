/**
 * Unit tests for the pure helpers behind the refund flow.
 *
 * Refund math + validation lives in `refund-helpers.ts` so we can pin
 * its contract without booting RN's expo-router / Zustand stack. The
 * blueprint (refund-flow + tip-allocation-on-partial-refunds) calls
 * out partial selection, mandatory reason, the "full vs partial" gate,
 * and the per-component breakdown (subtotal/tax/tip/discount) as the
 * surface area to lock down.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ZERO_PRIORS,
  clampQty,
  computeRefundBreakdown,
  computeRefundCents,
  isFullRefund,
  selectAll,
  totalSelectedQty,
  validateRefund,
  type RefundOrderTotals,
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

// 2x350 + 1x220 = 920 subtotal. Tipped + taxed order used by the
// breakdown tests below.
const tippedOrder: RefundOrderTotals = {
  subtotalCents: 920,
  taxCents: 110, // ~12% of 920 (912 floored or 110 hand-set)
  tipCents: 50,
  discountCents: 0,
};

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

test('selectAll', () => {
  const sel = selectAll(lines);
  assert.deepEqual(sel.qtyById, { 'item-1': 2, 'item-2': 1 });
  assert.equal(isFullRefund(lines, sel), true);
});

test('computeRefundBreakdown — partial refund', async (t) => {
  await t.test('excludes tip and pro-rates tax by subtotal share', () => {
    // Refund just one croissant (220 of 920 = ~23.9%).
    const sel: RefundSelection = { qtyById: { 'item-2': 1 } };
    const b = computeRefundBreakdown(tippedOrder, lines, sel);
    assert.equal(b.subtotalCents, 220);
    // floor(110 × 220 / 920) = floor(26.30) = 26.
    assert.equal(b.taxCents, 26);
    assert.equal(b.tipCents, 0, 'tip stays put on a partial refund');
    assert.equal(b.discountCents, 0);
    assert.equal(b.amountCents, 220 + 26 - 0);
    assert.equal(b.closesOut, false);
  });

  await t.test('pro-rates discount when present', () => {
    const order: RefundOrderTotals = {
      subtotalCents: 1000,
      taxCents: 0,
      tipCents: 0,
      discountCents: 100, // 10% off the order
    };
    const oneLine: RefundableLine[] = [
      { id: 'a', variantId: 'v', nameSnapshot: 'X', originalQty: 4, unitPriceCents: 250 },
    ];
    const sel: RefundSelection = { qtyById: { a: 1 } }; // 250 of 1000 = 25%
    const b = computeRefundBreakdown(order, oneLine, sel);
    assert.equal(b.subtotalCents, 250);
    // 25% of 100 = 25 reversed.
    assert.equal(b.discountCents, 25);
    // Customer gets back 250 - 25 = 225 (no tax, no tip).
    assert.equal(b.amountCents, 225);
    assert.equal(b.closesOut, false);
  });
});

test('computeRefundBreakdown — full refund (single shot)', async (t) => {
  await t.test('returns subtotal + full tax + full tip and matches order.total', () => {
    const sel = selectAll(lines);
    const b = computeRefundBreakdown(tippedOrder, lines, sel);
    assert.equal(b.subtotalCents, 920);
    assert.equal(b.taxCents, 110);
    assert.equal(b.tipCents, 50);
    assert.equal(b.discountCents, 0);
    assert.equal(b.amountCents, 920 + 110 + 50);
    assert.equal(b.closesOut, true);
  });
});

test('computeRefundBreakdown — closing-out captures rounding remainder', async (t) => {
  // Order with tax that doesn't divide evenly across the lines: 920
  // subtotal, 111 tax. Pro-rating 111 by line shares loses cents to
  // floor(); the closing refund must take whatever is left.
  const order: RefundOrderTotals = {
    subtotalCents: 920,
    taxCents: 111,
    tipCents: 50,
    discountCents: 0,
  };

  await t.test('two partials sum to the order total exactly', () => {
    // Partial 1: refund item-1 entirely (700 / 920).
    const sel1: RefundSelection = { qtyById: { 'item-1': 2 } };
    const b1 = computeRefundBreakdown(order, lines, sel1, ZERO_PRIORS);
    assert.equal(b1.closesOut, false);
    assert.equal(b1.subtotalCents, 700);
    // floor(111 × 700 / 920) = floor(84.456…) = 84.
    assert.equal(b1.taxCents, 84);
    assert.equal(b1.tipCents, 0);

    // Partial 2: refund item-2 (220 / 920) — closes the order out.
    const sel2: RefundSelection = { qtyById: { 'item-2': 1 } };
    const priors = {
      subtotalCents: b1.subtotalCents,
      taxCents: b1.taxCents,
      tipCents: b1.tipCents,
      discountCents: b1.discountCents,
    };
    const b2 = computeRefundBreakdown(order, lines, sel2, priors);
    assert.equal(b2.closesOut, true);
    assert.equal(b2.subtotalCents, 220);
    // Captures remainder: 111 - 84 = 27.
    assert.equal(b2.taxCents, 27);
    // Tip released in full on closing.
    assert.equal(b2.tipCents, 50);

    // Σ across partials matches the original order line-for-line.
    const sumSubtotal = b1.subtotalCents + b2.subtotalCents;
    const sumTax = b1.taxCents + b2.taxCents;
    const sumTip = b1.tipCents + b2.tipCents;
    const sumAmount = b1.amountCents + b2.amountCents;
    assert.equal(sumSubtotal, order.subtotalCents);
    assert.equal(sumTax, order.taxCents);
    assert.equal(sumTip, order.tipCents);
    const orderTotal = order.subtotalCents + order.taxCents + order.tipCents - order.discountCents;
    assert.equal(sumAmount, orderTotal);
  });

  await t.test('closing refund captures the discount remainder too', () => {
    const orderWithDiscount: RefundOrderTotals = {
      subtotalCents: 920,
      taxCents: 0,
      tipCents: 0,
      discountCents: 11, // pro-rated by floor() will leave a remainder
    };
    const sel1: RefundSelection = { qtyById: { 'item-1': 2 } };
    const b1 = computeRefundBreakdown(orderWithDiscount, lines, sel1, ZERO_PRIORS);
    // floor(11 × 700 / 920) = floor(8.36) = 8.
    assert.equal(b1.discountCents, 8);

    const sel2: RefundSelection = { qtyById: { 'item-2': 1 } };
    const b2 = computeRefundBreakdown(orderWithDiscount, lines, sel2, {
      subtotalCents: b1.subtotalCents,
      taxCents: 0,
      tipCents: 0,
      discountCents: b1.discountCents,
    });
    assert.equal(b2.closesOut, true);
    // Captures 11 - 8 = 3.
    assert.equal(b2.discountCents, 3);
  });
});

test('computeRefundBreakdown — zero-cent edges', async (t) => {
  await t.test('zero-subtotal comp order does not divide by zero', () => {
    const compOrder: RefundOrderTotals = {
      subtotalCents: 0,
      taxCents: 0,
      tipCents: 0,
      discountCents: 0,
    };
    const free: RefundableLine[] = [
      { id: 'free', variantId: 'v', nameSnapshot: 'Comp', originalQty: 1, unitPriceCents: 0 },
    ];
    const sel: RefundSelection = { qtyById: { free: 1 } };
    const b = computeRefundBreakdown(compOrder, free, sel);
    assert.equal(b.subtotalCents, 0);
    assert.equal(b.taxCents, 0);
    assert.equal(b.tipCents, 0);
    assert.equal(b.amountCents, 0);
    // Closes-out so the order can flip to `refunded` even at ₱0.
    assert.equal(b.closesOut, true);
  });

  await t.test('empty selection on a real order does not close out', () => {
    const b = computeRefundBreakdown(tippedOrder, lines, { qtyById: {} });
    assert.equal(b.subtotalCents, 0);
    assert.equal(b.tipCents, 0);
    assert.equal(b.closesOut, false);
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
