/**
 * Unit tests for the pure loyalty helpers.
 *
 * Covers: program matching (product vs category, archived skip),
 * available-redemption math (floor(earned/threshold) - redeemed),
 * cheapest-first redemption picking with multi-unit lines, and the
 * post-checkout earned-punch enumeration.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  availableRedemptions,
  earnedPunchesByProgram,
  lineMatchesProgram,
  loyaltyDiscountCents,
  pickRedemptions,
  progressTowardNext,
  type CartLineSnapshot,
  type LoyaltyProgramSnapshot,
} from '../src/state/loyalty-helpers';

const drinksCategory: LoyaltyProgramSnapshot = {
  id: 'prog-drinks',
  targetType: 'category',
  targetId: 'cat-drinks',
  threshold: 10,
  status: 'active',
};

const espressoProduct: LoyaltyProgramSnapshot = {
  id: 'prog-espresso',
  targetType: 'product',
  targetId: 'prod-espresso',
  threshold: 5,
  status: 'active',
};

const espressoLine: CartLineSnapshot = {
  lineId: 'line-1',
  productId: 'prod-espresso',
  categoryId: 'cat-drinks',
  unitPriceCents: 350,
  qty: 1,
};

const croissantLine: CartLineSnapshot = {
  lineId: 'line-2',
  productId: 'prod-croissant',
  categoryId: 'cat-pastry',
  unitPriceCents: 220,
  qty: 1,
};

test('lineMatchesProgram', async (t) => {
  await t.test('product program matches productId', () => {
    assert.equal(lineMatchesProgram(espressoLine, espressoProduct), true);
    assert.equal(lineMatchesProgram(croissantLine, espressoProduct), false);
  });
  await t.test('category program matches categoryId', () => {
    assert.equal(lineMatchesProgram(espressoLine, drinksCategory), true);
    assert.equal(lineMatchesProgram(croissantLine, drinksCategory), false);
  });
  await t.test('archived programs never match', () => {
    const archived: LoyaltyProgramSnapshot = { ...espressoProduct, status: 'archived' };
    assert.equal(lineMatchesProgram(espressoLine, archived), false);
  });
  await t.test('null categoryId never matches a category program', () => {
    const lineNoCat = { ...espressoLine, categoryId: null };
    assert.equal(lineMatchesProgram(lineNoCat, drinksCategory), false);
  });
});

test('availableRedemptions', async (t) => {
  await t.test('floor(earned/threshold) - redeemed', () => {
    const out = availableRedemptions(
      [drinksCategory],
      { 'prog-drinks': 22 },
      { 'prog-drinks': 1 },
    );
    assert.equal(out['prog-drinks'], 1); // floor(22/10) = 2; 2 - 1 = 1
  });
  await t.test('clamps to zero', () => {
    const out = availableRedemptions(
      [drinksCategory],
      { 'prog-drinks': 5 },
      { 'prog-drinks': 0 },
    );
    assert.equal(out['prog-drinks'], undefined); // floor(5/10) = 0
  });
  await t.test('skips archived programs', () => {
    const archived: LoyaltyProgramSnapshot = { ...drinksCategory, status: 'archived' };
    const out = availableRedemptions([archived], { 'prog-drinks': 100 }, {});
    assert.equal(Object.keys(out).length, 0);
  });
  await t.test('zero/negative threshold is a no-op', () => {
    const broken: LoyaltyProgramSnapshot = { ...drinksCategory, threshold: 0 };
    const out = availableRedemptions([broken], { 'prog-drinks': 100 }, {});
    assert.equal(Object.keys(out).length, 0);
  });
});

test('pickRedemptions', async (t) => {
  await t.test('redeems one cheapest qualifying unit per credit', () => {
    const lines: CartLineSnapshot[] = [
      { ...espressoLine, qty: 2 }, // 350 each
      { ...croissantLine, lineId: 'line-3', categoryId: 'cat-drinks', unitPriceCents: 280, qty: 1 }, // forced into drinks
    ];
    const applied = pickRedemptions(lines, [drinksCategory], { 'prog-drinks': 1 });
    assert.equal(applied.length, 1);
    // Cheapest qualifying unit (280) wins.
    assert.equal(applied[0]?.discountCents, 280);
    assert.equal(applied[0]?.programId, 'prog-drinks');
  });
  await t.test('does not over-redeem a line', () => {
    const lines: CartLineSnapshot[] = [{ ...espressoLine, qty: 1 }];
    const applied = pickRedemptions(lines, [drinksCategory], { 'prog-drinks': 5 });
    // qty=1 → only one unit can be redeemed
    assert.equal(applied.length, 1);
  });
  await t.test('zero credits → empty', () => {
    const applied = pickRedemptions([espressoLine], [drinksCategory], {});
    assert.equal(applied.length, 0);
  });
});

test('loyaltyDiscountCents', () => {
  const applied = [
    { lineId: 'a', programId: 'p', discountCents: 350 },
    { lineId: 'b', programId: 'p', discountCents: 220 },
  ];
  assert.equal(loyaltyDiscountCents(applied), 570);
});

test('progressTowardNext', async (t) => {
  await t.test('counts earned mod threshold (no redemptions)', () => {
    assert.equal(progressTowardNext(8, 0, 10), 8);
  });
  await t.test('subtracts one threshold per redemption', () => {
    // earned=12, redeemed=1, threshold=10 → 12 - 10 = 2 toward the next free
    assert.equal(progressTowardNext(12, 1, 10), 2);
  });
  await t.test('clamps at zero', () => {
    // earned=5, redeemed=1, threshold=10 → 5 - 10 = -5 → clamped to 0
    assert.equal(progressTowardNext(5, 1, 10), 0);
  });
  await t.test('zero / negative threshold is a no-op', () => {
    assert.equal(progressTowardNext(100, 0, 0), 0);
    assert.equal(progressTowardNext(100, 0, -5), 0);
  });
});

test('earnedPunchesByProgram', async (t) => {
  await t.test('redeemed units earn no punches under any matching program', () => {
    const lines: CartLineSnapshot[] = [
      { ...espressoLine, qty: 3 }, // 3 espressos qualify under both programs
    ];
    const programs = [espressoProduct, drinksCategory];
    const applied = [
      { lineId: 'line-1', programId: 'prog-drinks', discountCents: 350 },
    ];
    const earned = earnedPunchesByProgram(lines, programs, applied);
    // Conservative semantic: a free unit doesn't earn anywhere — the
    // customer didn't pay for it. So 3 sold - 1 free = 2 paid → both
    // programs earn 2 punches.
    const espressoCount = earned.filter((p) => p.programId === 'prog-espresso').length;
    const drinksCount = earned.filter((p) => p.programId === 'prog-drinks').length;
    assert.equal(espressoCount, 2);
    assert.equal(drinksCount, 2);
  });
  await t.test('archived program contributes nothing', () => {
    const archived: LoyaltyProgramSnapshot = { ...espressoProduct, status: 'archived' };
    const earned = earnedPunchesByProgram([espressoLine], [archived], []);
    assert.equal(earned.length, 0);
  });
  await t.test('no redemptions → one punch per qualifying unit per matching program', () => {
    const lines: CartLineSnapshot[] = [{ ...espressoLine, qty: 1 }];
    const programs = [espressoProduct, drinksCategory];
    const earned = earnedPunchesByProgram(lines, programs, []);
    assert.equal(earned.length, 2); // one under espresso, one under drinks
  });
});
