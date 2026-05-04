/**
 * Receipt formatter tests.
 *
 * The sale-receipt formatter has been in production since W4 — these
 * tests pin the refund-receipt counter-entry added with the
 * tip-allocation Blueprint follow-up so we don't regress the breakdown
 * lines, the "of original" reference, or the reason rendering.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatReceiptText,
  formatRefundReceiptText,
} from '../src/format';

import type {
  ReceiptItem,
  ReceiptOrder,
  RefundReceipt,
  RefundReceiptLine,
} from '../src/types';

const baseOrder: ReceiptOrder = {
  id: 'order-12345678-aaaa',
  createdAt: '2026-05-04T08:30:00.000Z',
  totalCents: 1170,
  subtotalCents: 1000,
  taxCents: 120,
  tipCents: 50,
  paymentMethod: 'cash',
  storeName: 'Counter',
  currency: 'PHP',
};

const baseItems: ReceiptItem[] = [
  { nameSnapshot: 'Espresso · Single', qty: 2, unitPriceCents: 350 },
  { nameSnapshot: 'Croissant', qty: 1, unitPriceCents: 300 },
];

test('formatReceiptText (sanity — sale receipt unchanged)', async (t) => {
  await t.test('renders subtotal/tax/tip lines and the store header', () => {
    const out = formatReceiptText(baseOrder, baseItems);
    assert.match(out, /Counter/);
    assert.match(out, /Espresso · Single/);
    assert.match(out, /Subtotal/);
    assert.match(out, /Tax/);
    assert.match(out, /Tip/);
    assert.match(out, /Total/);
  });
});

const baseRefund: RefundReceipt = {
  id: 'refund-cafebabe-bbbb',
  orderId: 'order-12345678-aaaa',
  createdAt: '2026-05-04T09:00:00.000Z',
  amountCents: 560, // partial: 500 + 60 tax, no tip
  subtotalCents: 500,
  taxCents: 60,
  tipCents: 0,
  discountCents: 0,
  originalTotalCents: 1170,
  reason: 'One drink wrong',
  cashierName: 'Aileen',
  storeName: 'Counter',
  currency: 'PHP',
};

const baseRefundLines: RefundReceiptLine[] = [
  { nameSnapshot: 'Espresso · Single', qty: 1, unitPriceCents: 350 },
];

test('formatRefundReceiptText', async (t) => {
  await t.test('shows the REFUND header so it cannot be confused with a sale receipt', () => {
    const out = formatRefundReceiptText(baseRefund, baseRefundLines);
    assert.match(out, /REFUND/);
  });

  await t.test('renders refunded line items with qty × name and line total', () => {
    const out = formatRefundReceiptText(baseRefund, baseRefundLines);
    assert.match(out, /1× Espresso · Single/);
  });

  await t.test('renders Items + Tax + Refund total breakdown when tax is non-zero', () => {
    const out = formatRefundReceiptText(baseRefund, baseRefundLines);
    assert.match(out, /Items/);
    assert.match(out, /Tax/);
    assert.match(out, /Refund total/);
    assert.doesNotMatch(out, /^Tip/m, 'tip suppressed when tipCents = 0');
  });

  await t.test('shows "of <original>" so the customer sees how much remains', () => {
    const out = formatRefundReceiptText(baseRefund, baseRefundLines);
    // 1170 cents = ₱11.70; the formatter renders the currency symbol +
    // the standard locale separator. Match on the structural words +
    // the digits, not the exact symbol.
    assert.match(out, /of \S*11\.70\s+original/);
  });

  await t.test('renders the reason note when present', () => {
    const out = formatRefundReceiptText(baseRefund, baseRefundLines);
    assert.match(out, /Reason: One drink wrong/);
  });

  await t.test('omits the reason line when null/undefined', () => {
    const out = formatRefundReceiptText(
      { ...baseRefund, reason: null },
      baseRefundLines,
    );
    assert.doesNotMatch(out, /Reason:/);
  });

  await t.test('renders the tip line when this refund closes out the order', () => {
    const closingRefund: RefundReceipt = {
      ...baseRefund,
      id: 'refund-closing',
      amountCents: 610,
      subtotalCents: 500,
      taxCents: 60,
      tipCents: 50,
    };
    const out = formatRefundReceiptText(closingRefund, baseRefundLines);
    assert.match(out, /Tip/);
  });

  await t.test('renders Discount reversed as a negative line when discount > 0', () => {
    const refundWithDiscount: RefundReceipt = {
      ...baseRefund,
      discountCents: 25,
      amountCents: 560 - 25,
    };
    const out = formatRefundReceiptText(refundWithDiscount, baseRefundLines);
    assert.match(out, /Discount reversed/);
  });
});
