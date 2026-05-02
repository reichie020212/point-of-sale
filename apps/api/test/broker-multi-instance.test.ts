/**
 * Cross-instance broker fan-out test.
 *
 * The existing `pubsub.test.ts` covers a single-broker round-trip and
 * channel isolation, but that only proves the publisher and subscriber
 * agree *within* one process. The production deployment shape — two
 * Fastify replicas behind a load balancer talking to one Redis — needs
 * proof that an event published on broker A reaches a subscriber on
 * broker B *across* separately-constructed broker instances.
 *
 * Each `createBroker(REDIS_URL)` call produces its own
 * publisher+subscriber `ioredis` pair, so two separate brokers in the
 * same Node process behave the same on the wire as two brokers in
 * different processes (they share nothing but Redis).
 *
 * Auto-skips if REDIS_URL is unreachable so contributors without a
 * local Redis stay green; CI provisions a redis:7 service container.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { Redis } from 'ioredis';

import { createBroker, type Broker, type SyncFanoutEvent } from '../src/sync/pubsub.js';

const REDIS_URL = process.env.REDIS_URL;

async function redisReachable(): Promise<boolean> {
  if (!REDIS_URL) return false;
  const probe = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
    enableOfflineQueue: false,
  });
  try {
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

async function waitFor<T>(
  predicate: () => T | undefined,
  timeoutMs = 1000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

test('cross-instance broker', async (t) => {
  if (!(await redisReachable())) {
    t.skip('REDIS_URL not reachable; skipping (CI provisions redis:7).');
    return;
  }

  let brokerA: Broker | null = null;
  let brokerB: Broker | null = null;
  try {
    brokerA = createBroker(REDIS_URL);
    brokerB = createBroker(REDIS_URL);

    const orgId = `org-${Date.now()}-a`;
    const otherOrgId = `org-${Date.now()}-b`;
    const received: SyncFanoutEvent[] = [];
    const otherReceived: SyncFanoutEvent[] = [];

    const unsubscribeOrg = await brokerB.subscribe(orgId, (e) => {
      received.push(e);
    });
    const unsubscribeOther = await brokerB.subscribe(otherOrgId, (e) => {
      otherReceived.push(e);
    });

    await t.test('publish on A reaches subscriber on B (record carries through)', async () => {
      const event: SyncFanoutEvent = {
        type: 'record_updated',
        orgId,
        table: 'products',
        id: '00000000-0000-0000-0000-000000000001',
        version: '42',
        // Blueprint #18: full row rides the EVENT so receivers don't
        // race the cursor. The wire shape is what serializeRow emits
        // (snake_case keys, ISO timestamps, decimal-string bigints).
        record: {
          id: '00000000-0000-0000-0000-000000000001',
          org_id: orgId,
          name: 'Espresso',
          status: 'active',
          version: '42',
          updated_at: '2026-05-03T12:00:00.000Z',
          deleted_at: null,
        },
      };
      await brokerA!.publish(orgId, event);
      const got = await waitFor(() => (received.length > 0 ? received[0] : undefined));
      assert.deepEqual(got, event);
      assert.equal(got.type, 'record_updated');
      if (got.type === 'record_updated') {
        assert.equal(got.record.org_id, orgId);
        assert.equal(got.record.name, 'Espresso');
      }
    });

    await t.test('cross-instance fan-out preserves org isolation', async () => {
      const otherOrgEvent: SyncFanoutEvent = {
        type: 'record_updated',
        orgId: 'unsubscribed-org',
        table: 'products',
        id: '00000000-0000-0000-0000-000000000002',
        version: '7',
        record: { id: '00000000-0000-0000-0000-000000000002', org_id: 'unsubscribed-org' },
      };
      await brokerA!.publish('unsubscribed-org', otherOrgEvent);

      const targetedEvent: SyncFanoutEvent = {
        type: 'record_updated',
        orgId: otherOrgId,
        table: 'products',
        id: '00000000-0000-0000-0000-000000000003',
        version: '8',
        record: { id: '00000000-0000-0000-0000-000000000003', org_id: otherOrgId, name: 'Latte' },
      };
      await brokerA!.publish(otherOrgId, targetedEvent);

      const got = await waitFor(() => (otherReceived.length > 0 ? otherReceived[0] : undefined));
      assert.deepEqual(got, targetedEvent);
      // The unsubscribed-org publish must not have leaked into either bucket.
      assert.equal(received.length, 1, 'orgId channel did not pick up other org');
      assert.equal(otherReceived.length, 1, 'otherOrg channel did not pick up unsubscribed org');
    });

    await t.test('unsubscribe on B stops further deliveries from A', async () => {
      await unsubscribeOrg();
      await brokerA!.publish(orgId, {
        type: 'record_updated',
        orgId,
        table: 'products',
        id: '00000000-0000-0000-0000-000000000004',
        version: '99',
        record: { id: '00000000-0000-0000-0000-000000000004', org_id: orgId, name: 'Mocha' },
      });
      // Give the wire a moment; the unsubscribe should have removed the
      // listener before this event lands.
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(received.length, 1, 'unsubscribe must stop deliveries');
    });

    await unsubscribeOther();
  } finally {
    await Promise.allSettled([brokerA?.close(), brokerB?.close()]);
  }
});
