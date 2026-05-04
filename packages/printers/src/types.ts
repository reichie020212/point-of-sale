/**
 * ReceiptPrinter — abstraction for the post-sale receipt artefact.
 *
 * Implementations:
 *   - MockPrinter      → no-op, for CI and dev
 *   - WebPrinter       → uses the browser print dialog (web dashboard)
 *   - BLEThermalPrinter → real Star/Epson thermal printer (W5 hardware)
 *
 * The receipt domain object is intentionally minimal; full templating
 * lives in `formatReceipt()` once we lock the layout.
 */
export interface ReceiptOrder {
  id: string;
  createdAt: string; // ISO
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  paymentMethod: 'cash' | 'card' | 'split' | 'mock';
  cashierName?: string;
  storeName?: string;
  /** ISO 4217 currency code. Receipt formatter routes this to Intl. */
  currency?: string;
}

export interface ReceiptItem {
  nameSnapshot: string;
  qty: number;
  unitPriceCents: number;
  modifiersSummary?: string;
}

/**
 * Receipt artefact for a refund. Mirrors `ReceiptOrder` but for the
 * counter-entry — itemized lines actually returned, the per-component
 * breakdown (subtotal/tax/tip/discount), the cashier's reason note, and
 * a reference to the original order's total so the customer can see
 * "₱560 of ₱1,170 returned".
 */
export interface RefundReceipt {
  /** Refund row id. */
  id: string;
  /** Original order id this refund belongs to. */
  orderId: string;
  /** ISO timestamp of the refund. */
  createdAt: string;
  /** Net cash returned to the customer (= subtotal + tax + tip − discount). */
  amountCents: number;
  /** Sum of returned line subtotals. */
  subtotalCents: number;
  /** Tax portion returned. */
  taxCents: number;
  /** Tip portion returned (0 unless this refund closes the order out). */
  tipCents: number;
  /** Discount portion reversed (subtracted from amountCents). */
  discountCents: number;
  /** Total of the original order, for reference ("of ₱X"). */
  originalTotalCents: number;
  /** Free-text reason captured at refund time. */
  reason?: string | null;
  cashierName?: string;
  storeName?: string;
  /** ISO 4217 currency code; same as the original sale. */
  currency?: string;
}

/**
 * One refunded line for the receipt. `qty` is the qty being returned
 * by THIS refund (not the original line qty).
 */
export interface RefundReceiptLine {
  nameSnapshot: string;
  qty: number;
  unitPriceCents: number;
}

export type PrinterType = 'mock' | 'web' | 'ble';

export interface ReceiptPrinter {
  readonly type: PrinterType;
  readonly label: string;
  print(order: ReceiptOrder, items: ReceiptItem[]): Promise<void>;
  /**
   * Print a refund receipt. Same interface shape as `print`; lines are
   * the units actually returned (not the original cart). BLE is the
   * only implementation that may throw — Mock + Web work everywhere.
   */
  printRefund(refund: RefundReceipt, lines: RefundReceiptLine[]): Promise<void>;
}
