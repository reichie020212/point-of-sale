/**
 * useSync — owns the lifetime of the sync client.
 *
 * Mount once at the root layout. The hook starts the WebSocket on
 * mount, hands the queue helpers to the client, and stops on unmount.
 *
 * `onRecord` upserts the row into the matching local table. The
 * upsert lives in src/sync/upsert.ts (M6) — for now we log; once
 * Watermelon models land it becomes a real DB write.
 */
// eslint-disable-next-line import/no-named-as-default
import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';

import { database } from '../db';
import { useOrgSettings } from '../state/org-settings';

import { SyncClient } from './client';
import { drain, markAcked, markFailed } from './queue';
import { upsertRecord } from './upsert';

export function useSync() {
  const clientRef = useRef<SyncClient | null>(null);

  useEffect(() => {
    const apiBase =
      (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000';
    const wsUrl = apiBase.replace(/^http/i, 'ws') + '/sync';

    const client = new SyncClient({
      url: wsUrl,
      drainQueue: async () => drain(50),
      ackOp: async (clientOpId, ok, error) => {
        if (ok) await markAcked(clientOpId);
        else await markFailed(clientOpId, error ?? 'ack_failed');
      },
      onRecord: async (table, record) => {
        // Org settings live in a Zustand slice, not WatermelonDB —
        // intercept here so a dashboard tax-rate / currency / timezone
        // edit reaches the cart math reactively (Blueprint #19).
        if (table === 'organizations') {
          await useOrgSettings.getState().applyFromRecord(record);
          return;
        }
        await upsertRecord(database, table, record);
      },
    });
    clientRef.current = client;
    void client.start();

    return () => {
      void client.stop();
      clientRef.current = null;
    };
  }, []);
}
