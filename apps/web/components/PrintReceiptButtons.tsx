/**
 * Web-side Print buttons for sale + refund receipts.
 *
 * Lives in a 'use client' component because `WebPrinter` opens an
 * iframe and triggers `window.print()` — both browser-only. The
 * server-rendered order detail page passes plain data into these
 * buttons; no event handlers cross the server/client boundary.
 *
 * Mirrors the mobile order detail page's Print receipt button so the
 * dashboard can produce a paper trail for the customer when they pick
 * up a refund in person.
 */
'use client';

import {
  WebPrinter,
  type ReceiptItem,
  type ReceiptOrder,
  type RefundReceipt,
  type RefundReceiptLine,
} from '@counter/printers';

const printer = new WebPrinter();

interface PrintReceiptOrderButtonProps {
  order: ReceiptOrder;
  items: ReceiptItem[];
  className?: string;
  label?: string;
}

export function PrintReceiptOrderButton({
  order,
  items,
  className,
  label = 'Print receipt',
}: PrintReceiptOrderButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        void printer.print(order, items);
      }}
      className={
        className ??
        'rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-ink hover:bg-surface-2'
      }
    >
      {label}
    </button>
  );
}

interface PrintRefundButtonProps {
  refund: RefundReceipt;
  lines: RefundReceiptLine[];
  className?: string;
  label?: string;
}

export function PrintRefundButton({
  refund,
  lines,
  className,
  label = 'Print',
}: PrintRefundButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        void printer.printRefund(refund, lines);
      }}
      className={
        className ??
        'rounded border border-line-2 bg-surface px-2 py-1 text-xs text-ink hover:bg-surface-2'
      }
    >
      {label}
    </button>
  );
}
