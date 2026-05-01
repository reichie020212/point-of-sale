/**
 * Mobile sync WebSocket client.
 *
 * Maintains a single connection to /sync with auto-reconnect (HANDOFF
 * §4: ping every 15s, exponential backoff capped at 30s). Pushes are
 * queued in WatermelonDB's `sync_queue` table; this client drains the
 * queue FIFO whenever the connection is healthy.
 *
 * Conflict resolution lives server-side; the client just relays.
 *
 * Boundary cases the W6 implementation MUST eventually handle (left
 * as TODO until we have a real device + multi-device test rig per
 * Out-of-Scope in master Blueprint §10):
 *   - Token refresh / 401 mid-session.
 *   - Backpressure when the local queue grows faster than the server
 *     can ack.
 *   - Clock-skew detection on Lamport cursor jumps.
 */
import {
  cursorFromString,
  cursorToString,
  decodeServerMessage,
  encodeClientMessage,
  type ClientMessage,
  type ServerMessage,
  type SyncTable,
} from '@counter/sync';
import * as SecureStore from 'expo-secure-store';

import { useSyncStatus, type SyncStatus } from '../state/sync-status';

import type { QueuedOp } from './queue';

const TOKEN_KEY = 'counter.deviceToken';
const CURSOR_KEY = 'counter.syncCursor';

const PING_INTERVAL_MS = 15_000;
const MAX_BACKOFF_MS = 30_000;

export interface SyncClientOptions {
  url: string;
  /** Pulls queued ops in FIFO order. Empty array if drained. */
  drainQueue: () => Promise<QueuedOp[]>;
  /** Marks an op as ack'd (and possibly retries on error). */
  ackOp: (clientOpId: string, ok: boolean, error?: string) => Promise<void>;
  /** Receives a record streamed by the server (PULL or EVENT). */
  onRecord: (table: SyncTable, record: Record<string, unknown>) => Promise<void>;
}

export class SyncClient {
  private socket: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private cursor = 0n;
  private deviceId = 'unpaired';
  private closed = false;

  constructor(private readonly opts: SyncClientOptions) {}

  async start(): Promise<void> {
    this.closed = false;
    this.cursor = await loadCursor();
    this.deviceId = (await SecureStore.getItemAsync('counter.deviceId')) ?? 'unpaired';
    await this.openSocket();
  }

  async stop(): Promise<void> {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.socket?.close();
    this.socket = null;
    this.setStatus('offline');
  }

  /**
   * Push a single op. The op is also persisted in the local queue so
   * a kill mid-flight survives — the queue is the source of truth.
   */
  async push(): Promise<void> {
    const ops = await this.opts.drainQueue();
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (ops.length === 0) return;
    const msg: ClientMessage = {
      type: 'push',
      ops: ops.map((op) => ({
        clientOpId: op.clientOpId,
        table: op.table,
        data: op.payload,
        asDelta: op.asDelta,
      })),
    };
    this.send(msg);
    this.setStatus('syncing');
  }

  private async openSocket(): Promise<void> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) {
      this.setStatus('offline');
      return;
    }
    this.setStatus('connecting');
    const url = new URL(this.opts.url);
    url.searchParams.set('token', token);
    const socket = new WebSocket(url.toString());
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.send({
        type: 'hello',
        deviceId: this.deviceId,
        cursor: cursorToString(this.cursor),
        tables: [],
      });
      this.setStatus('live');
      this.pingTimer = setInterval(() => {
        this.send({ type: 'ping' });
      }, PING_INTERVAL_MS);
      // Drain any queued ops on (re)connect.
      void this.push();
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      void this.handleMessage(event.data);
    };

    socket.onerror = () => {
      this.setStatus('offline');
    };

    socket.onclose = () => {
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      this.socket = null;
      if (!this.closed) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.setStatus('connecting');
    this.reconnectTimer = setTimeout(() => {
      void this.openSocket();
    }, delay);
  }

  private async handleMessage(raw: string): Promise<void> {
    let msg: ServerMessage;
    try {
      msg = decodeServerMessage(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case 'ping':
        this.send({ type: 'pong' });
        return;
      case 'pong':
        return;
      case 'pull':
      case 'event': {
        const records = msg.type === 'pull' ? msg.records : [msg.record];
        for (const record of records) {
          await this.opts.onRecord(msg.table, record);
        }
        const next = cursorFromString(msg.cursor);
        if (next > this.cursor) {
          this.cursor = next;
          await saveCursor(this.cursor);
        }
        useSyncStatus.getState().set({ lastPullAt: Date.now() });
        if (msg.type === 'pull' && msg.done) this.setStatus('live');
        return;
      }
      case 'ack':
        for (const result of msg.results) {
          await this.opts.ackOp(result.clientOpId, result.ok, result.error);
        }
        this.setStatus('live');
        return;
      case 'error':
        // eslint-disable-next-line no-console
        console.warn('[sync] server error', msg.code, msg.message);
        if (msg.code === 'tier_required') this.setStatus('disabled');
        return;
    }
  }

  private send(msg: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeClientMessage(msg));
  }

  private setStatus(status: SyncStatus): void {
    useSyncStatus.getState().set({ status });
  }
}

async function loadCursor(): Promise<bigint> {
  const raw = await SecureStore.getItemAsync(CURSOR_KEY);
  if (!raw) return 0n;
  try {
    return cursorFromString(raw);
  } catch {
    return 0n;
  }
}

async function saveCursor(cursor: bigint): Promise<void> {
  await SecureStore.setItemAsync(CURSOR_KEY, cursorToString(cursor));
}
