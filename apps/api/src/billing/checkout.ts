/**
 * Stripe Checkout / Customer Portal session creators.
 *
 * Both helpers expect a `Stripe` instance + a billing row. Callers
 * (the route layer) are responsible for authn (Clerk + owner role)
 * and for ensuring a billing row exists for the org before calling
 * `createPortalSession`. `createCheckoutSession` will create or
 * reuse the Stripe customer the first time an org checks out.
 */
import type Stripe from 'stripe';

export interface CheckoutInput {
  /** Counter org id — stamped on the session metadata so the
   *  webhook can resolve the linkage after Stripe redirects back. */
  orgId: string;
  /** Stable display name on the Stripe Customer for clarity in the
   *  Stripe dashboard. */
  orgName: string;
  /** Stripe Price object id. */
  priceId: string;
  /** Existing Stripe Customer id, or null on first-time checkout. */
  existingCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(
  stripe: Stripe,
  input: CheckoutInput,
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // Either reuse the existing customer or let Stripe create a new
    // one and we'll persist its id from the webhook. We deliberately
    // don't pre-create a customer here because that would leak a
    // "phantom" Stripe customer if the user abandons checkout.
    customer: input.existingCustomerId ?? undefined,
    customer_creation: input.existingCustomerId ? undefined : 'always',
    // Stamp the org id on both the session and the subscription it
    // creates so the webhook can resolve them back to a Counter org
    // even if the customer record were ever deleted.
    metadata: { orgId: input.orgId },
    subscription_data: { metadata: { orgId: input.orgId } },
    client_reference_id: input.orgId,
    // PHP per §9; subscription mode handles recurring billing
    // automatically based on the Stripe Product's price config.
  });
  return session;
}

export interface PortalInput {
  customerId: string;
  returnUrl: string;
}

export async function createPortalSession(
  stripe: Stripe,
  input: PortalInput,
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}
