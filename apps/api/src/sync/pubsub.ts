/**
 * Pub/Sub for sync fan-out.
 *
 * In a multi-instance deployment a PUSH from device A connected to
 * instance X must reach device B connected to instance Y. We use Redis
 * Pub/Sub keyed by `sync:org:<orgId>`: each WebSocket subscribes to
 * its org's channel and rebroadcasts incoming messages to its socket.
 *
 * The broker is selected at boot:
 *   - REDIS_URL set     → real ioredis publisher + subscriber.
 *   - REDIS_URL unset   → in-process EventEmitter (single-instance dev).
 *
 * Both implementations expose the same `Broker` interface so the sync
 * handler doesn't care which one it has. Tests boot the in-process
 * broker by default and a Redis-backed one only when REDIS_URL is set.
 */
import { EventEmitter } from 'node:events';

import { Redis } from 'ioredis';

export type SyncFanoutEvent =
  | { type: 'record_updated'; orgId: string; table: string; id: string; version: string }
  | { type: 'record_deleted'; orgId: string; table: string; id: string; version: string };

export type FanoutListener = (event: SyncFanoutEvent) => void;

export interface Broker {
  publish(orgId: string, event: SyncFanoutEvent): Promise<void>;
  subscribe(orgId: string, listener: FanoutListener): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

function channel(orgId: string): string {
  return `sync:org:${orgId}`;
}

class InProcessBroker implements Broker {
  private readonly emitter = new EventEmitter();

  constructor() {
    // High org count under load → bump the default 10-listener cap.
    this.emitter.setMaxListeners(0);
  }

  async publish(orgId: string, event: SyncFanoutEvent): Promise<void> {
    this.emitter.emit(channel(orgId), event);
  }

  async subscribe(orgId: string, listener: FanoutListener): Promise<() => Promise<void>> {
    const ch = channel(orgId);
    this.emitter.on(ch, listener);
    return async () => {
      this.emitter.off(ch, listener);
    };
  }

  async close(): Promise<void> {
    this.emitter.removeAllListeners();
  }
}

class RedisBroker implements Broker {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly listeners = new Map<string, Set<FanoutListener>>();

  constructor(url: string) {
    this.publisher = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1 });
    this.subscriber = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1 });
    this.subscriber.on('message', (ch: string, payload: string) => {
      const set = this.listeners.get(ch);
      if (!set || set.size === 0) return;
      let event: SyncFanoutEvent;
      try {
        event = JSON.parse(payload) as SyncFanoutEvent;
      } catch {
        return;
      }
      for (const listener of set) listener(event);
    });
  }

  async publish(orgId: string, event: SyncFanoutEvent): Promise<void> {
    await this.publisher.publish(channel(orgId), JSON.stringify(event));
  }

  async subscribe(orgId: string, listener: FanoutListener): Promise<() => Promise<void>> {
    const ch = channel(orgId);
    let set = this.listeners.get(ch);
    if (!set) {
      set = new Set();
      this.listeners.set(ch, set);
      await this.subscriber.subscribe(ch);
    }
    set.add(listener);
    return async () => {
      const current = this.listeners.get(ch);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(ch);
        await this.subscriber.unsubscribe(ch);
      }
    };
  }

  async close(): Promise<void> {
    this.listeners.clear();
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }
}

export function createBroker(redisUrl: string | undefined): Broker {
  if (!redisUrl) return new InProcessBroker();
  return new RedisBroker(redisUrl);
}
