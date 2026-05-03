/**
 * Pure helpers for the refund flow. Kept out of the screen file so they
 * can be unit-tested without React-Native imports in the way.
 *
 * Allocation rules (Blueprint: tip-allocation-on-partial-refunds):
 *   - **Subtotal**: Σ (qty_selected × unit_price) over selected lines.
 *     Exact (integer cents in, integer cents out).
 *   - **Tax**: pro-rate by subtotal share —
 *       floor(order.tax_cents × this_subtotal / order.subtotal_cents)
 *     except on the closing-out refund (the one that brings cumulative
 *     refunded subtotal up to order.subtotal_cents) which captures the
 *     remainder so Σ refunds.tax_cents === order.tax_cents exactly.
 *   - **Discount**: same pro-rate rule as tax.
 *   - **Tip**: all-or-nothing. Zero on every refund except the
 *     closing-out one, which returns the full order.tip_cents (less any
 *     previously refunded tip — there shouldn't be any, but the math
 *     handles it).
 *
 * Why all-or-nothing tip: in PH, tipping is a gesture for the service
 * rendered, often a small flat amount. If a customer keeps most of the
 * order, the staff still did the work, so the tip stays. Only when the
 * whole order is reversed does the gesture get revoked.
 *
 * `partial` vs `full` is a UI concern only; the server recomputes the
 * order's status from the cumulative refund total in the writer.
 */

export interface RefundableLine {
  /** Order item id (server_id). Stable per-line identifier. */
  id: string;
  variantId: string;
  nameSnapshot: string;
  /** Original quantity on the order item. */
  originalQty: number;
  /** Per-unit price in cents (already includes any modifier deltas
   *  baked at sale time). */
  unitPriceCents: number;
}

export interface RefundSelection {
  /** Map of `RefundableLine.id` → qty selected for refund. */
  qtyById: Record<string, number>;
}

/** Just the money fields we need from the order to allocate breakdowns. */
export interface RefundOrderTotals {
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  discountCents: number;
}

/** Sum of prior refunds' breakdown fields. Used for closing-out detection
 *  and remainder capture. Pass `{0,0,0,0}` if this is the first refund. */
export interface PriorRefundsSum {
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  discountCents: number;
}

export interface RefundBreakdown {
  /** Sum of selected (qty × unit price). */
  subtotalCents: number;
  /** Pro-rated tax to be returned. */
  taxCents: number;
  /** Tip to be returned (0 unless closing-out). */
  tipCents: number;
  /** Pro-rated discount to be reversed (subtracted from amount_cents). */
  discountCents: number;
  /** Net amount returned to the customer:
   *  subtotal + tax + tip - discount. */
  amountCents: number;
  /** True iff this refund brings cumulative refunded subtotal up to
   *  the order's subtotal (i.e. every original unit will have been
   *  refunded). The UI uses this for copy ("Refund full order"); the
   *  helper uses it to release the tip + capture rounding remainders. */
  closesOut: boolean;
}

export const ZERO_PRIORS: PriorRefundsSum = {
  subtotalCents: 0,
  taxCents: 0,
  tipCents: 0,
  discountCents: 0,
};

export function clampQty(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return Math.floor(value);
}

export function totalSelectedQty(selection: RefundSelection): number {
  let total = 0;
  for (const v of Object.values(selection.qtyById)) total += v;
  return total;
}

/**
 * Compute the refund subtotal in cents from a selection over the given
 * lines. Lines absent from the selection contribute zero.
 */
export function computeRefundCents(
  lines: RefundableLine[],
  selection: RefundSelection,
): number {
  let total = 0;
  for (const line of lines) {
    const qty = selection.qtyById[line.id] ?? 0;
    if (qty <= 0) continue;
    total += qty * line.unitPriceCents;
  }
  return total;
}

/**
 * True iff the selection covers every unit on every line — i.e. the
 * full order is being refunded in this single refund.
 */
export function isFullRefund(
  lines: RefundableLine[],
  selection: RefundSelection,
): boolean {
  if (lines.length === 0) return false;
  for (const line of lines) {
    const qty = selection.qtyById[line.id] ?? 0;
    if (qty < line.originalQty) return false;
  }
  return true;
}

/**
 * Compute the full breakdown for a refund: subtotal + tax + tip −
 * discount, with closing-out detection.
 *
 * Closing-out semantics: this refund is "closing out" iff applying it
 * brings cumulative refunded subtotal to order.subtotalCents. On the
 * closing refund:
 *   - tip is released in full (less any priorTip, which should be 0)
 *   - tax/discount take the remainder so cumulative sums match the
 *     order exactly
 * Otherwise tax/discount are floor-pro-rated and tip is 0.
 *
 * Math invariant when an order is fully refunded across N partials:
 *   Σ refunds.subtotal_cents = order.subtotal_cents
 *   Σ refunds.tax_cents      = order.tax_cents
 *   Σ refunds.tip_cents      = order.tip_cents
 *   Σ refunds.discount_cents = order.discount_cents
 *   Σ refunds.amount_cents   = order.total_cents
 */
export function computeRefundBreakdown(
  order: RefundOrderTotals,
  lines: RefundableLine[],
  selection: RefundSelection,
  priors: PriorRefundsSum = ZERO_PRIORS,
): RefundBreakdown {
  const thisSubtotal = computeRefundCents(lines, selection);
  const cumulativeSubtotal = priors.subtotalCents + thisSubtotal;
  // `>=` not `===` so an over-claim (shouldn't happen — UI clamps) still
  // closes the order out instead of leaving it stuck partial.
  const closesOut =
    order.subtotalCents > 0
      ? cumulativeSubtotal >= order.subtotalCents
      : // Zero-subtotal orders (100%-discounted, comp'd) close out the
        // moment any line is selected, since there's nothing to pro-rate
        // against.
        thisSubtotal >= 0 && totalSelectedQty(selection) > 0;

  let taxCents: number;
  let discountCents: number;
  let tipCents: number;

  if (closesOut) {
    // Closing refund: take everything that hasn't been allocated yet.
    // Subtraction-from-priors guarantees Σ matches the order exactly,
    // even when prior refunds floor()'d their pro-rated shares.
    taxCents = Math.max(0, order.taxCents - priors.taxCents);
    discountCents = Math.max(0, order.discountCents - priors.discountCents);
    tipCents = Math.max(0, order.tipCents - priors.tipCents);
  } else {
    // Partial: pro-rate tax + discount by subtotal share. Tip stays put.
    taxCents = proRate(order.taxCents, thisSubtotal, order.subtotalCents);
    discountCents = proRate(order.discountCents, thisSubtotal, order.subtotalCents);
    tipCents = 0;
  }

  const amountCents = thisSubtotal + taxCents + tipCents - discountCents;

  return {
    subtotalCents: thisSubtotal,
    taxCents,
    tipCents,
    discountCents,
    amountCents,
    closesOut,
  };
}

/** Floor-pro-rate `total × num/den` in integer cents. Returns 0 if the
 *  denominator is zero (zero-subtotal order — the closing-out branch
 *  handles those instead). */
function proRate(total: number, num: number, den: number): number {
  if (den <= 0) return 0;
  if (total === 0) return 0;
  // `Math.floor` is the rounding policy: every partial rounds down,
  // and the closing-out refund picks up the accumulated remainder.
  return Math.floor((total * num) / den);
}

export interface RefundValidation {
  ok: boolean;
  reason?: string;
}

/**
 * Validate a refund submission. Reason text is required (HANDOFF §9
 * locked decision: "reason required"); selection must move at least
 * one unit and the computed breakdown must be a positive amount.
 */
export function validateRefund(
  lines: RefundableLine[],
  selection: RefundSelection,
  reasonText: string,
): RefundValidation {
  if (totalSelectedQty(selection) <= 0) {
    return { ok: false, reason: 'Select at least one item to refund.' };
  }
  if (reasonText.trim().length === 0) {
    return { ok: false, reason: 'A reason is required.' };
  }
  if (computeRefundCents(lines, selection) <= 0) {
    return { ok: false, reason: 'Refund amount must be greater than zero.' };
  }
  return { ok: true };
}

/** "Select all units of every line" — the one-tap full-refund preset. */
export function selectAll(lines: RefundableLine[]): RefundSelection {
  const qtyById: Record<string, number> = {};
  for (const line of lines) qtyById[line.id] = line.originalQty;
  return { qtyById };
}
