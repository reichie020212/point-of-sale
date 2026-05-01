/**
 * Browser print-dialog implementation.
 *
 * Opens a hidden iframe, writes the formatted receipt HTML into it,
 * and triggers `window.print()`. Works in any modern browser; useful
 * for the web dashboard's per-order receipt preview.
 */
import { formatReceiptHtml } from './format';

import type { ReceiptItem, ReceiptOrder, ReceiptPrinter } from './types';

export class WebPrinter implements ReceiptPrinter {
  readonly type = 'web' as const;
  readonly label = 'Browser print dialog';

  async print(order: ReceiptOrder, items: ReceiptItem[]): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('WebPrinter can only run in a browser');
    }
    const html = formatReceiptHtml(order, items);
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      document.body.removeChild(frame);
      throw new Error('Print iframe failed to attach a document');
    }
    doc.open();
    doc.write(`<!doctype html><html><body>${html}</body></html>`);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
    return Promise.resolve();
  }
}
