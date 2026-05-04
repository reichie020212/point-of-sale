import { formatReceiptText, formatRefundReceiptText } from './format';

import type {
  ReceiptItem,
  ReceiptOrder,
  ReceiptPrinter,
  RefundReceipt,
  RefundReceiptLine,
} from './types';

/** Logs the formatted receipt. Used in CI and dev. */
export class MockPrinter implements ReceiptPrinter {
  readonly type = 'mock' as const;
  readonly label = 'Mock';

  async print(order: ReceiptOrder, items: ReceiptItem[]): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('[printer/mock]\n' + formatReceiptText(order, items));
    return Promise.resolve();
  }

  async printRefund(refund: RefundReceipt, lines: RefundReceiptLine[]): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('[printer/mock/refund]\n' + formatRefundReceiptText(refund, lines));
    return Promise.resolve();
  }
}
