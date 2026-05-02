/**
 * Counter API HTTP client.
 *
 * Wraps `fetch` with auth + error normalisation. Endpoints are typed
 * against the request/response shapes the API actually emits.
 *
 * Token strategy:
 *   - Persisted in expo-secure-store under `counter.deviceToken`.
 *   - In M4/M5 the mobile app does not yet drive the Clerk pairing
 *     flow itself; the user pastes a dev token via Settings during
 *     bring-up. M6 replaces this with the real device pairing flow.
 */
// eslint-disable-next-line import/no-named-as-default
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'counter.deviceToken';

const baseUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getToken(): Promise<string | null> {
  return (await SecureStore.getItemAsync(TOKEN_KEY)) ?? null;
}

export async function setDeviceToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearDeviceToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

interface RequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (init.body) headers['content-type'] = 'application/json';

  const url = new URL(path, baseUrl);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: init.method ?? 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(res.status, body.error ?? 'unknown', body.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ProductSummary {
  id: string;
  orgId: string;
  categoryId: string | null;
  name: string;
  status: 'active' | 'archived';
}

export interface VariantSummary {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  priceCents: number;
}

export interface PairResponse {
  device: { id: string; name: string; model: string | null; orgId: string };
  token: string;
}

export interface ActiveOrgSummary {
  org: {
    id: string;
    name: string;
    slug: string;
    region: string;
    tier: string;
    timezone: string;
    currency: string;
    /** Numeric percent as a decimal string, e.g. `'12.000'` for PH VAT. */
    taxRate: string;
  };
}

export const apiCalls = {
  listProducts: (query?: { categoryId?: string; cursor?: string; limit?: number }) =>
    api<{ products: ProductSummary[]; nextCursor: string | null }>('/api/v1/products', {
      query,
    }),
  getProduct: (id: string) =>
    api<{ product: ProductSummary; variants: VariantSummary[]; modifiers: unknown[] }>(
      `/api/v1/products/${id}`,
    ),
  listCategories: () =>
    api<{ categories: Array<{ id: string; name: string; sortOrder: number }> }>(
      '/api/v1/categories',
    ),
  pair: (body: { code: string; name?: string; model?: string }) =>
    api<PairResponse>('/api/v1/devices/pair', { method: 'POST', body }),
  getActiveOrg: () => api<ActiveOrgSummary>('/api/v1/orgs/active'),
};
