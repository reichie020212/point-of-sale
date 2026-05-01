/**
 * Server-side API client for Next.js server components and actions.
 *
 * Uses the Clerk session via `auth().getToken()`. The same Bearer token
 * the API expects from mobile devices works here.
 */
import { auth } from '@clerk/nextjs/server';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

export async function api<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const { getToken } = auth();
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');

  const url = new URL(path, baseUrl);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(res.status, body.error ?? 'unknown', body.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ProductRow {
  id: string;
  orgId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  updatedAt: string;
}
