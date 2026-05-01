/**
 * Sync status — surfaced in the chrome at the top of every screen.
 * The full sync engine wires this in M6; M4 ships the store shape.
 */
import { create } from 'zustand';

export type SyncStatus = 'connecting' | 'live' | 'offline' | 'syncing' | 'disabled';

interface SyncStatusState {
  status: SyncStatus;
  /** Most-recent successful pull, ms since epoch. */
  lastPullAt: number | null;
  /** Bytes pending in the local sync_queue table. */
  pending: number;
  set: (s: Partial<SyncStatusState>) => void;
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  status: 'offline',
  lastPullAt: null,
  pending: 0,
  set: (next) => set(next),
}));
