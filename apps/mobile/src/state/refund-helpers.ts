/**
 * Pure helpers for the refund flow. Kept out of the screen file so they
 * can be unit-tested without React-Native imports in the way.
 *
 * Contract:
 *   - Each line tracks a max refundable qty (the original line qty minus
 *     anything already refunded — server is the source of truth, we just
 *     cap optimistically at the original qty for the first pass).
 *   - The selected qty per line is clamped to [0, maxQty].
 *   - The refund amount in cents is the sum of (selected qty × line
 *     unit price), rounded the same way the cart computes it (qty ×
 *     unitPrice with no fractional cents — modifiers are baked into the
 *     line subtotal already).
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
 * Compute the refund amount in cents from a selection over the given
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
 * True iff the selection refunds every unit on every line — i.e. the
 * full order is being refunded. Used by the UI as a hint; the server
 * makes the final call.
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

export interface RefundValidation {
  ok: boolean;
  reason?: string;
}

/**
 * Validate a refund submission. Reason text is required (HANDOFF §9
 * locked decision: "reason required"); selection must move at least
 * one unit.
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
