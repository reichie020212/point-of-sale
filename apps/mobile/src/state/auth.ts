/**
 * Active-cashier session.
 *
 * The mobile app authenticates the *device* via a paired token
 * (`useDevice`). On top of that, an individual cashier signs in via a
 * 4-digit PIN — that's this slice. The active user's id stamps every
 * order's `cashier_id` and every refund's `processed_by_id`.
 *
 * Lifetime: the session is ephemeral by design. Sign-out (or app kill)
 * clears it; the next launch shows the PIN screen again. We do NOT
 * persist the active user to SecureStore — leaving a phone unlocked
 * shouldn't grant transaction attribution to whoever used it last.
 *
 * Verification is offline: `users` is sync-replicated, so PIN check is
 * a local Watermelon query.
 */
import { Q } from '@nozbe/watermelondb';
import { create } from 'zustand';

import { database } from '../db';

import { hashPin, isValidPin } from './pin-hash';

import type { User as UserModel } from '../db/models/User';

export interface ActiveUser {
  id: string;
  name: string | null;
  role: 'owner' | 'manager' | 'cashier';
}

export interface SignInResult {
  ok: boolean;
  /** Only set when ok=false; explains the failure reason for the UI. */
  reason?: 'no-match' | 'invalid-pin';
}

interface AuthState {
  activeUser: ActiveUser | null;
  signIn: (pin: string) => Promise<SignInResult>;
  signOut: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  activeUser: null,
  signIn: async (pin) => {
    if (!isValidPin(pin)) return { ok: false, reason: 'invalid-pin' };
    // Pull every local user with a non-null pin_hash. Team sizes are
    // small (single-digit usually); iterating is fine. Locking down
    // to a fingerprint-sized prefix is a future optimisation if a
    // shop ever has 100+ cashiers.
    const candidates = await database
      .get<UserModel>('users')
      .query(Q.where('pin_hash', Q.notEq(null)))
      .fetch();
    for (const user of candidates) {
      if (user.pinHash && hashPin(user.serverId, pin) === user.pinHash) {
        const role = (user.role === 'owner' || user.role === 'manager' ? user.role : 'cashier') as
          | 'owner'
          | 'manager'
          | 'cashier';
        set({
          activeUser: {
            id: user.serverId,
            name: user.name,
            role,
          },
        });
        return { ok: true };
      }
    }
    return { ok: false, reason: 'no-match' };
  },
  signOut: () => set({ activeUser: null }),
}));
