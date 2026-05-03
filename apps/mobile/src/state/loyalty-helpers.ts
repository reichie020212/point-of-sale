/**
 * Pure helpers behind the punchcard loyalty flow. Kept out of the cart
 * / hook files so they can be unit tested without RN imports.
 *
 * Domain:
 *   - A `loyalty_programs` row says "buy `threshold` of target X (a
 *     specific product or any product in a category) to earn one free
 *     unit of the same target."
 *   - The customer's progress is the count of `loyalty_punches` rows
 *     for that program with `is_redemption = false`. Redeeming a free
 *     unit writes a `loyalty_punches` row with `is_redemption = true`,
 *     which conceptually consumes `threshold` punches.
 *   - At checkout the cart auto-flags qualifying lines as redemptions
 *     while the customer's outstanding redemption credits are positive.
 *
 * "Eligibility" math (intentionally in JS, not the server) so the
 * register can show a "Free!" badge and a discount line offline.
 */

export interface LoyaltyProgramSnapshot {
  id: string;
  /** 'product' or 'category' (validated upstream). */
  targetType: 'product' | 'category';
  /** Product or category id (depending on targetType). */
  targetId: string;
  threshold: number;
  status: 'active' | 'archived';
}

export interface CartLineSnapshot {
  lineId: string;
  productId: string;
  /** Category id of the line's product (looked up from the catalog). */
  categoryId: string | null;
  /** Per-unit price in cents (excluding any modifier deltas — modifier
   *  prices stay outside the loyalty calculation; the redemption only
   *  zeroes the base unit). */
  unitPriceCents: number;
  /** Quantity of this line in the cart. */
  qty: number;
}

/**
 * Does the line qualify for this program's punches / redemption?
 * - product programs match on productId
 * - category programs match on categoryId
 * Archived programs never match.
 */
export function lineMatchesProgram(
  line: CartLineSnapshot,
  program: LoyaltyProgramSnapshot,
): boolean {
  if (program.status !== 'active') return false;
  if (program.targetType === 'product') return line.productId === program.targetId;
  if (program.targetType === 'category') {
    return line.categoryId !== null && line.categoryId === program.targetId;
  }
  return false;
}

/**
 * For each program, how many free units the customer is currently
 * entitled to redeem. Computed as `floor(earned / threshold) - redeemed`,
 * never negative.
 *
 * `earnedByProgram` and `redeemedByProgram` are independent counts of
 * `loyalty_punches` rows partitioned by `is_redemption`. Each
 * redemption row consumes one credit (not `threshold` rows of earned),
 * so the math is `floor(earned/threshold) - redeemed`.
 */
export function availableRedemptions(
  programs: LoyaltyProgramSnapshot[],
  earnedByProgram: Record<string, number>,
  redeemedByProgram: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const program of programs) {
    if (program.status !== 'active') continue;
    if (program.threshold <= 0) continue;
    const earned = earnedByProgram[program.id] ?? 0;
    const redeemed = redeemedByProgram[program.id] ?? 0;
    const credits = Math.max(0, Math.floor(earned / program.threshold) - redeemed);
    if (credits > 0) out[program.id] = credits;
  }
  return out;
}

export interface AppliedRedemption {
  /** Cart line being redeemed. */
  lineId: string;
  /** Program responsible for the redemption. */
  programId: string;
  /** Amount discounted off the line's per-unit price (always =
   *  the line's unitPriceCents at apply time). */
  discountCents: number;
}

/**
 * Pick lines to flag as redemptions, given how many credits the
 * customer has per program. Strategy: greedily pick the cheapest
 * qualifying *unit* per credit so the discount is minimised — this
 * is the policy small shops actually expect when "buy 9 get the 10th
 * free": the "10th" is whichever same-category drink the customer
 * ordered, not necessarily the priciest one. Each redemption consumes
 * one unit of qty on the matched line; if qty > 1 a second credit may
 * land on the same line.
 *
 * Returns one entry per redeemed unit (so qty=2 on a free croissant
 * yields two AppliedRedemption entries with the same lineId).
 */
export function pickRedemptions(
  lines: CartLineSnapshot[],
  programs: LoyaltyProgramSnapshot[],
  credits: Record<string, number>,
): AppliedRedemption[] {
  const remaining: Record<string, number> = { ...credits };
  // Track per-line "units already consumed by a prior redemption" so
  // we don't redeem more units of a line than its qty.
  const consumedByLine: Record<string, number> = {};
  const applied: AppliedRedemption[] = [];

  for (const program of programs) {
    if ((remaining[program.id] ?? 0) <= 0) continue;
    // Candidate units: every (line, unit) pair that matches the
    // program and hasn't been consumed yet. Sort cheapest first.
    type Candidate = { lineId: string; unitPriceCents: number };
    const candidates: Candidate[] = [];
    for (const line of lines) {
      if (!lineMatchesProgram(line, program)) continue;
      const consumed = consumedByLine[line.lineId] ?? 0;
      const free = Math.max(0, line.qty - consumed);
      for (let i = 0; i < free; i++) {
        candidates.push({ lineId: line.lineId, unitPriceCents: line.unitPriceCents });
      }
    }
    candidates.sort((a, b) => a.unitPriceCents - b.unitPriceCents);

    while ((remaining[program.id] ?? 0) > 0 && candidates.length > 0) {
      const c = candidates.shift()!;
      applied.push({
        lineId: c.lineId,
        programId: program.id,
        discountCents: c.unitPriceCents,
      });
      consumedByLine[c.lineId] = (consumedByLine[c.lineId] ?? 0) + 1;
      remaining[program.id] = (remaining[program.id] ?? 0) - 1;
    }
  }

  return applied;
}

/** Sum of discount cents across applied redemptions. */
export function loyaltyDiscountCents(applied: AppliedRedemption[]): number {
  let total = 0;
  for (const r of applied) total += r.discountCents;
  return total;
}

/**
 * For the post-checkout punch ledger: how many *new* punches each
 * program should record for the lines just sold. Each non-redeemed
 * unit of a qualifying line contributes one punch. Redemptions are
 * tracked separately by `pickRedemptions` and do not earn punches.
 */
export function earnedPunchesByProgram(
  lines: CartLineSnapshot[],
  programs: LoyaltyProgramSnapshot[],
  applied: AppliedRedemption[],
): { programId: string; lineId: string }[] {
  const consumedByLine: Record<string, number> = {};
  for (const r of applied) {
    consumedByLine[r.lineId] = (consumedByLine[r.lineId] ?? 0) + 1;
  }
  const punches: { programId: string; lineId: string }[] = [];
  for (const program of programs) {
    if (program.status !== 'active') continue;
    for (const line of lines) {
      if (!lineMatchesProgram(line, program)) continue;
      const consumed = consumedByLine[line.lineId] ?? 0;
      const earnedHere = Math.max(0, line.qty - consumed);
      for (let i = 0; i < earnedHere; i++) {
        punches.push({ programId: program.id, lineId: line.lineId });
      }
    }
  }
  return punches;
}
