/**
 * Clerk JWT verification — Fastify preHandler.
 *
 * Strategy: every request to /api/v1/** must carry a valid Clerk session
 * token in the Authorization header. We verify it with @clerk/backend
 * (which fetches Clerk's JWKS, caches it, and rotates keys automatically),
 * then attach a minimal `auth` object to the request.
 *
 * For Week 1 the device id is approximated by the Clerk session id, per
 * the JWT template `counter-sync-v1` set in the Clerk dashboard. Once the
 * `devices` table lands (W5/6) the verifier will look up the device id
 * separately and replace `auth.deviceId`.
 */
import { createClerkClient, verifyToken } from '@clerk/backend';
import fp from 'fastify-plugin';

import type { Config } from '../config.js';
import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      userId: string;
      sessionId: string;
      orgId: string | null;
      /** Approximated as sessionId in Week 1; real device id in W5/6. */
      deviceId: string;
    };
  }
}

export interface ClerkPluginOptions {
  config: Config;
}

const PUBLIC_PREFIXES = ['/healthz'];

export const clerkAuthPlugin = fp<ClerkPluginOptions>(async (app, opts) => {
  const { config } = opts;
  const clerk = createClerkClient({
    secretKey: config.CLERK_SECRET_KEY,
    publishableKey: config.CLERK_PUBLISHABLE_KEY,
  });
  app.decorate('clerk', clerk);

  app.addHook('preHandler', async (request, reply) => {
    if (PUBLIC_PREFIXES.some((p) => request.url.startsWith(p))) return;

    const token = extractBearer(request);
    if (!token) {
      reply.code(401).send({ error: 'missing_authorization', message: 'Bearer token required' });
      return;
    }

    // Test-only bypass (master Blueprint M14): when NODE_ENV=test and the
    // bearer matches TEST_BEARER, skip JWKS verification and synthesize an
    // auth object from TEST_USER_ID / TEST_ORG_ID. Production rejects
    // these env vars at config load.
    if (
      config.NODE_ENV === 'test' &&
      process.env.TEST_BEARER &&
      token === process.env.TEST_BEARER
    ) {
      request.auth = {
        userId: process.env.TEST_USER_ID ?? 'user_test',
        sessionId: 'session_test',
        orgId: process.env.TEST_CLERK_ORG_ID ?? null,
        deviceId: 'device_test',
      };
      return;
    }

    try {
      const verified = await verifyToken(token, { secretKey: config.CLERK_SECRET_KEY });
      const sessionId = verified.sid;
      const userId = verified.sub;
      if (!sessionId || !userId) {
        reply.code(401).send({ error: 'invalid_token', message: 'Token missing required claims' });
        return;
      }
      request.auth = {
        userId,
        sessionId,
        orgId: (verified.org_id as string | undefined) ?? null,
        deviceId: sessionId, // TODO(W5): replace with paired device id
      };
    } catch (err) {
      request.log.warn({ err }, 'Clerk token verification failed');
      reply.code(401).send({ error: 'invalid_token', message: 'Token verification failed' });
    }
  });
});

function extractBearer(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
