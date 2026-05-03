/**
 * Environment config — parsed once at startup. Fail fast on missing values
 * so we never boot with half a configuration.
 */
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),

  /**
   * Redis connection for cross-instance sync fan-out (and, eventually,
   * rate limiting). Optional in development — when unset, the API uses
   * an in-process pub/sub stub and a single instance behaves correctly,
   * but multi-instance deployments need a real broker.
   */
  REDIS_URL: z.string().url().optional(),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  /**
   * Stripe billing config. All four are optional in development /
   * test so the API can still boot without Stripe wired up — the
   * billing endpoints return 503 when the secret key is missing,
   * the rest of the surface keeps working. Production deployments
   * MUST set all four (the bootstrap has no way to enforce this
   * because we want CI to run without leaking a real Stripe key).
   *
   * - STRIPE_SECRET_KEY: `sk_test_...` or `sk_live_...`
   * - STRIPE_WEBHOOK_SECRET: `whsec_...` from `stripe listen` (dev)
   *   or the dashboard endpoint settings (prod). Used to verify the
   *   HMAC signature on incoming webhook events.
   * - STRIPE_PRICE_PRO / STRIPE_PRICE_BUSINESS: the Stripe Price
   *   object ids (`price_...`) for the two paid tiers. Configured
   *   in Stripe to be PHP recurring monthly per §9.
   * - BILLING_SUCCESS_URL / BILLING_CANCEL_URL: where Stripe
   *   Checkout redirects after the cardholder finishes / abandons
   *   the hosted page. Defaults sit on the local web origin.
   */
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_BUSINESS: z.string().optional(),
  BILLING_SUCCESS_URL: z.string().url().default('http://localhost:3000/dashboard/billing?status=success'),
  BILLING_CANCEL_URL: z.string().url().default('http://localhost:3000/pricing?status=canceled'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
