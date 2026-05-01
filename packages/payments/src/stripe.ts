/**
 * Stripe Terminal provider — interface scaffold.
 *
 * Real implementation requires:
 *   - @stripe/stripe-terminal-react-native (mobile)
 *   - A real terminal device (BBPOS WisePOS E, Verifone P400, etc.)
 *   - Stripe account with Terminal access
 *
 * All three of those land in W5 field work. This file holds the
 * import path so consumers can write `new StripeTerminalProvider()`
 * today and wire it once the SDK is added.
 */
import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  RefundRequest,
  RefundResult,
} from './types';

export interface StripeTerminalOptions {
  /** Test or live publishable key. */
  publishableKey: string;
  /** Resolves a Connection Token from the Counter API. */
  fetchConnectionToken: () => Promise<string>;
}

export class StripeTerminalProvider implements PaymentProvider {
  readonly type = 'stripe' as const;
  readonly label = 'Card (Stripe Terminal)';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_opts: StripeTerminalOptions) {
    // TODO(W5): initialise the Stripe Terminal SDK here.
  }

  async charge(_request: ChargeRequest): Promise<ChargeResult> {
    return Promise.resolve({
      ok: false,
      errorCode: 'config',
      errorMessage: 'StripeTerminalProvider not implemented yet — needs hardware + SDK',
    });
  }

  async refund(_request: RefundRequest): Promise<RefundResult> {
    return Promise.resolve({
      ok: false,
      errorCode: 'config',
      errorMessage: 'StripeTerminalProvider not implemented yet',
    });
  }
}
