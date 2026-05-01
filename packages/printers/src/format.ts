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
import type { ReceiptItem, ReceiptOrder } from './types';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatReceiptText(order: ReceiptOrder, items: ReceiptItem[]): string {
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
