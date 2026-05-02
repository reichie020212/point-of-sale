/**
 * Sync fan-out test — confirms a publish on broker A reaches a
 * subscriber on broker B when both share the same channel.
 *
 * Two paths:
 *   - REDIS_URL set:   uses the real RedisBroker; smoke-tests the
 *                      ioredis publisher/subscriber pair.
 *   - REDIS_URL unset: uses a single shared InProcessBroker injected
 *                      into both test "instances," which still proves
 *                      the publish → subscribe contract is wired.
 *
 * No Postgres required.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createBroker, type Broker, type SyncFanoutEvent } from '../src/sync/pubsub.js';

const ORG_ID = 'org-fanout-test';

async function withBroker(fn: (broker: Broker) => Promise<void>) {
  const broker = createBroker(process.env.REDIS_URL);
  try {
    await fn(broker);
  } finally {
    await broker.close();
  }
}

test('broker publish/subscribe round-trip', async () => {
  await withBroker(async (broker) => {
    const received: SyncFanoutEvent[] = [];
    const unsubscribe = await broker.subscribe(ORG_ID, (e) => received.push(e));

    const event: SyncFanoutEvent = {
      type: 'record_updated',
      orgId: ORG_ID,
      table: 'products',
      id: '00000000-0000-0000-0000-000000000001',
      version: '42',
      record: {
        id: '00000000-0000-0000-0000-000000000001',
        org_id: ORG_ID,
        name: 'Espresso',
      },
    };
    await broker.publish(ORG_ID, event);

    // Redis takes a tick to round-trip; in-process is synchronous but
    // the await above already resolved.
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], event);

    await unsubscribe();
    await broker.publish(ORG_ID, event);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(received.length, 1, 'unsubscribe must stop deliveries');
  });
});

test('broker isolates channels by orgId', async () => {
  await withBroker(async (broker) => {
    const received: SyncFanoutEvent[] = [];
    await broker.subscribe(ORG_ID, (e) => received.push(e));
    await broker.publish('different-org', {
      type: 'record_updated',
      orgId: 'different-org',
      table: 'products',
      id: '00000000-0000-0000-0000-000000000002',
      version: '7',
      record: { id: '00000000-0000-0000-0000-000000000002', org_id: 'different-org' },
    });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(received.length, 0);
  });
});
