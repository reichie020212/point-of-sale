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
}

export interface ReceiptItem {
  nameSnapshot: string;
  qty: number;
  unitPriceCents: number;
  modifiersSummary?: string;
}

export type PrinterType = 'mock' | 'web' | 'ble';

export interface ReceiptPrinter {
  readonly type: PrinterType;
  readonly label: string;
  print(order: ReceiptOrder, items: ReceiptItem[]): Promise<void>;
}
