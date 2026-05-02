/**
 * Org-settings slice.
 *
 * Cart math (subtotal × tax rate, money formatting) needs to know the
 * active org's `tax_rate` and `currency`. Three update paths feed it:
 *   1. `hydrate()` — boot, reads the last-cached value from
 *      expo-secure-store under `counter.orgSettings`.
 *   2. `refresh()` — REST `GET /api/v1/orgs/active` via device-token
 *      auth; called whenever device identity changes.
 *   3. `applyFromRecord()` — reactive path. Blueprint #19 makes the
 *      `organizations` row sync-replicated; useSync intercepts the
 *      EVENT and routes the snake_case record straight here, so a
 *      dashboard tax-rate / currency / timezone edit reaches the
 *      register without a REST round-trip.
 *
 * Defaults reflect HANDOFF §9 (PH-only launch): 12.000% VAT, PHP. The
 * defaults guarantee the cart always has a usable rate even before
 * the first refresh completes — the receipt won't show "0% tax" by
 * accident on a fresh install.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { apiCalls, ApiError } from '../api/client';

import {
  DEFAULT_ORG_SETTINGS,
  parseTaxRate,
  recordToSettings,
  type OrgSettings,
} from './org-settings-helpers';

export type { OrgSettings } from './org-settings-helpers';

const SETTINGS_KEY = 'counter.orgSettings';

const DEFAULTS = DEFAULT_ORG_SETTINGS;

interface OrgSettingsState {
  settings: OrgSettings;
  /** Whether settings have been loaded (from cache or network) at least once. */
  ready: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  /**
   * Apply a snake_case organization record from a sync EVENT. The
   * server's record_updated payload (Blueprint #18) carries the full
   * row; this lets a tax-rate / currency / timezone change reach the
   * register reactively, without a REST round-trip.
   */
  applyFromRecord: (record: Record<string, unknown>) => Promise<void>;
}

export const useOrgSettings = create<OrgSettingsState>((set, get) => ({
  settings: DEFAULTS,
  ready: false,
  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!raw) {
      set({ ready: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<OrgSettings>;
      set({
        settings: {
          taxRate: typeof parsed.taxRate === 'number' ? parsed.taxRate : DEFAULTS.taxRate,
          currency: typeof parsed.currency === 'string' ? parsed.currency : DEFAULTS.currency,
          timezone: typeof parsed.timezone === 'string' ? parsed.timezone : DEFAULTS.timezone,
        },
        ready: true,
      });
    } catch {
      await SecureStore.deleteItemAsync(SETTINGS_KEY);
      set({ ready: true });
    }
  },
  applyFromRecord: async (record) => {
    const next = recordToSettings(record, get().settings);
    set({ settings: next, ready: true });
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next));
  },
  refresh: async () => {
    try {
      const { org } = await apiCalls.getActiveOrg();
      const next: OrgSettings = {
        taxRate: parseTaxRate(org.taxRate),
        currency: org.currency,
        timezone: org.timezone,
      };
      set({ settings: next, ready: true });
      await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next));
    } catch (err) {
      // Offline or auth failure: keep whatever we already have. The
      // cart still has DEFAULTS or a previously cached value, so the
      // user can sell uninterrupted.
      if (err instanceof ApiError && err.status === 401) {
        // Token revoked; force a re-pair by clearing the cache so the
        // next boot doesn't keep stale tax rate from a prior org.
        await SecureStore.deleteItemAsync(SETTINGS_KEY);
        set({ settings: DEFAULTS });
      }
      // Mark ready so the cart doesn't gate on this; callers can
      // still see the network state via separate signals if needed.
      if (!get().ready) set({ ready: true });
    }
  },
}));

