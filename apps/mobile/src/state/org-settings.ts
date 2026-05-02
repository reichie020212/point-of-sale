/**
 * Org-settings slice.
 *
 * Cart math (subtotal × tax rate, money formatting) needs to know the
 * active org's `tax_rate` and `currency`. Mobile is paired-device-
 * authed against the API; we fetch `GET /api/v1/orgs/active` once on
 * boot and on identity changes, persist the result in expo-secure-
 * store, and use it as the source of truth in the cart.
 *
 * Defaults reflect HANDOFF §9 (PH-only launch): 12.000% VAT, PHP. The
 * defaults guarantee the cart always has a usable rate even before
 * the first refresh completes — the receipt won't show "0% tax" by
 * accident on a fresh install.
 *
 * Org-settings are not on the WatermelonDB sync loop yet; reactive
 * updates from the dashboard land on next mobile boot or next
 * `refresh()` call. Sync loop integration is a follow-up Blueprint.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { apiCalls, ApiError } from '../api/client';

const SETTINGS_KEY = 'counter.orgSettings';

export interface OrgSettings {
  /** Tax rate as a fraction (0.12 for 12% VAT). */
  taxRate: number;
  /** ISO 4217 currency code. */
  currency: string;
  /** IANA timezone, used by future receipt headers. */
  timezone: string;
}

const DEFAULTS: OrgSettings = {
  taxRate: 0.12,
  currency: 'PHP',
  timezone: 'UTC',
};

interface OrgSettingsState {
  settings: OrgSettings;
  /** Whether settings have been loaded (from cache or network) at least once. */
  ready: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
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

/**
 * Server stores `tax_rate` as `numeric(5,3)` and emits a string like
 * `'12.000'` (percent). Cart math wants a fraction (0.12), so divide
 * by 100. Bad input → 0 (no tax) so we never multiply by NaN.
 */
function parseTaxRate(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / 100;
}
