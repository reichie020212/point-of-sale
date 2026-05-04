/**
 * Receipt formatting — plain-text + minimal HTML.
 *
 * Plain-text version is what BLE thermal printers will actually emit
 * (most accept ESC/POS over a serial-style stream). The HTML version
 * is what WebPrinter renders into the print dialog.
 *
 * Formatting decisions are deliberately conservative — money in cents
 * formatted via Intl.NumberFormat, fixed monospace columns. Final
 * receipt design lands once we confirm the legal copy each region
 * requires (TODO(policy-region)).
 */
import type {
  ReceiptItem,
  ReceiptOrder,
  RefundReceipt,
  RefundReceiptLine,
} from './types';

export function formatReceiptText(order: ReceiptOrder, items: ReceiptItem[]): string {
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: order.currency ?? 'PHP',
  });
  const lines: string[] = [];
  lines.push(order.storeName ?? 'Counter');
  lines.push('');
  lines.push(`Order ${order.id.slice(0, 8)}`);
  lines.push(new Date(order.createdAt).toLocaleString('en-US'));
  lines.push('--------------------------------');
  for (const item of items) {
    lines.push(
      pad(`${item.qty}× ${item.nameSnapshot}`, 24) +
        pad(fmt.format((item.qty * item.unitPriceCents) / 100), 8, 'right'),
    );
    if (item.modifiersSummary) lines.push(`  ${item.modifiersSummary}`);
  }
  lines.push('--------------------------------');
  lines.push(pad('Subtotal', 24) + pad(fmt.format(order.subtotalCents / 100), 8, 'right'));
  if (order.taxCents > 0) {
    lines.push(pad('Tax', 24) + pad(fmt.format(order.taxCents / 100), 8, 'right'));
  }
  if (order.tipCents > 0) {
    lines.push(pad('Tip', 24) + pad(fmt.format(order.tipCents / 100), 8, 'right'));
  }
  lines.push(pad('Total', 24) + pad(fmt.format(order.totalCents / 100), 8, 'right'));
  lines.push('--------------------------------');
  lines.push(`Paid by ${order.paymentMethod}`);
  if (order.cashierName) lines.push(`Cashier: ${order.cashierName}`);
  lines.push('');
  lines.push('Thanks for stopping by.');
  return lines.join('\n');
}

export function formatReceiptHtml(order: ReceiptOrder, items: ReceiptItem[]): string {
  const text = formatReceiptText(order, items);
  return `<pre style="font-family: 'JetBrains Mono', ui-monospace, monospace; white-space: pre; line-height: 1.5;">${escapeHtml(text)}</pre>`;
}

/**
 * Format a refund counter-entry as plain text. Mirrors the sale layout
 * so a thermal-printed refund receipt sits next to its original sale
 * receipt as a recognizable pair.
 */
export function formatRefundReceiptText(
  refund: RefundReceipt,
  lines: RefundReceiptLine[],
): string {
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: refund.currency ?? 'PHP',
  });
  const out: string[] = [];
  out.push(refund.storeName ?? 'Counter');
  out.push('');
  out.push('REFUND');
  out.push(`Refund ${refund.id.slice(0, 8)}`);
  out.push(`Order ${refund.orderId.slice(0, 8)}`);
  out.push(new Date(refund.createdAt).toLocaleString('en-US'));
  out.push('--------------------------------');
  for (const line of lines) {
    out.push(
      pad(`${line.qty}× ${line.nameSnapshot}`, 24) +
        pad(fmt.format((line.qty * line.unitPriceCents) / 100), 8, 'right'),
    );
  }
  out.push('--------------------------------');
  out.push(pad('Items', 24) + pad(fmt.format(refund.subtotalCents / 100), 8, 'right'));
  if (refund.discountCents > 0) {
    // Discount is "un-applied" by the refund — it reduces the cash
    // returned, so render it as a negative line for parity with the
    // sale receipt's discount handling.
    out.push(
      pad('Discount reversed', 24) +
        pad('-' + fmt.format(refund.discountCents / 100), 8, 'right'),
    );
  }
  if (refund.taxCents > 0) {
    out.push(pad('Tax', 24) + pad(fmt.format(refund.taxCents / 100), 8, 'right'));
  }
  if (refund.tipCents > 0) {
    out.push(pad('Tip', 24) + pad(fmt.format(refund.tipCents / 100), 8, 'right'));
  }
  out.push(pad('Refund total', 24) + pad(fmt.format(refund.amountCents / 100), 8, 'right'));
  out.push(`of ${fmt.format(refund.originalTotalCents / 100)} original`);
  out.push('--------------------------------');
  if (refund.reason) out.push(`Reason: ${refund.reason}`);
  if (refund.cashierName) out.push(`Cashier: ${refund.cashierName}`);
  out.push('');
  out.push('Sorry for the trouble.');
  return out.join('\n');
}

export function formatRefundReceiptHtml(
  refund: RefundReceipt,
  lines: RefundReceiptLine[],
): string {
  const text = formatRefundReceiptText(refund, lines);
  return `<pre style="font-family: 'JetBrains Mono', ui-monospace, monospace; white-space: pre; line-height: 1.5;">${escapeHtml(text)}</pre>`;
}

function pad(s: string, width: number, align: 'left' | 'right' = 'left'): string {
  if (s.length >= width) return s.slice(0, width);
  const padding = ' '.repeat(width - s.length);
  return align === 'left' ? s + padding : padding + s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
