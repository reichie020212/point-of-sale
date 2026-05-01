/**
 * Mock provider used in CI and dev. Configurable failure mode.
 */
import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  RefundRequest,
  RefundResult,
} from './types';

export interface MockProviderOptions {
  /** Force every charge to fail with this code. Default: never fail. */
  forceFail?: NonNullable<ChargeResult['errorCode']>;
  /** Synthetic latency in ms. Default 0. */
  latencyMs?: number;
}

export class MockProvider implements PaymentProvider {
  readonly type = 'mock' as const;
  readonly label = 'Mock';

  constructor(private readonly opts: MockProviderOptions = {}) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (this.opts.latencyMs) await delay(this.opts.latencyMs);
    if (this.opts.forceFail) {
      return { ok: false, errorCode: this.opts.forceFail, errorMessage: 'mock failure' };
    }
    return { ok: true, transactionId: `mock:${request.clientOpId}` };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    if (this.opts.latencyMs) await delay(this.opts.latencyMs);
    return { ok: true, refundId: `mock-refund:${request.transactionId}` };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
