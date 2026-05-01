/**
 * Cash payment provider.
 *
 * No external call — the cashier counted money. We just record the
 * transaction with a stable id derived from the client op id so retries
 * are idempotent.
 */
import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  RefundRequest,
  RefundResult,
} from './types';

export class CashProvider implements PaymentProvider {
  readonly type = 'cash' as const;
  readonly label = 'Cash';

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (request.amountCents <= 0) {
      return Promise.resolve({
        ok: false,
        errorCode: 'config',
        errorMessage: 'amount must be positive',
      });
    }
    return Promise.resolve({ ok: true, transactionId: `cash:${request.clientOpId}` });
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    return Promise.resolve({
      ok: true,
      refundId: `cash-refund:${request.transactionId}:${Date.now().toString(36)}`,
    });
  }
}
