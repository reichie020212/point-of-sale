/**
 * PaymentProvider — the abstraction every checkout flow goes through.
 *
 * The mobile app and the web dashboard both build PaymentProvider
 * instances at boot (Cash always; Stripe Terminal only when the
 * org is on Pro+ and the device is paired with a reader).
 *
 * All money is integer cents. `currency` is ISO 4217.
 */
export type PaymentProviderType = 'cash' | 'mock' | 'stripe';

export interface ChargeRequest {
  amountCents: number;
  currency: string;
  /**
   * Stable id from the client side. Provider implementations MUST
   * dedupe on this — a retry of the same charge with the same id
   * must not double-charge.
   */
  clientOpId: string;
  /** Free-form metadata persisted with the transaction. */
  metadata?: Record<string, string>;
}

export interface ChargeResult {
  ok: boolean;
  /** Provider-side reference (Stripe charge id, "cash:<uuid>", etc.). */
  transactionId?: string;
  /** When ok=false, machine-readable category. */
  errorCode?: 'declined' | 'cancelled' | 'hardware' | 'timeout' | 'config' | 'unknown';
  /** When ok=false, human-readable detail. */
  errorMessage?: string;
}

export interface RefundRequest {
  transactionId: string;
  amountCents: number;
  reason?: string;
}

export interface RefundResult {
  ok: boolean;
  refundId?: string;
  errorCode?: ChargeResult['errorCode'];
  errorMessage?: string;
}

export interface PaymentProvider {
  readonly type: PaymentProviderType;
  /** Human label for surfacing on the UI ("Cash", "Stripe Terminal"). */
  readonly label: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
}
