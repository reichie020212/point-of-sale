'use server';

/**
 * Onboarding server actions.
 *
 * `createOrg` is the post-sign-up "Create your Shop" submit handler.
 *
 * It:
 *   1. uses Clerk's server-side `auth().getToken()` to mint a session JWT
 *      (the API trusts this via the same Clerk verifier);
 *   2. POSTs to apps/api `POST /api/v1/orgs` with name + slug + region;
 *   3. on success, redirects to /dashboard. On failure, returns the
 *      validation issues so the form can render them.
 *
 * TODO(W5): when the real device-token flow lands, swap this for the
 * paired-device JWT instead of the raw Clerk session.
 *
 * TODO(open-question): tax engine selection is part of "Create your Shop"
 * per HANDOFF §9 — left as a placeholder. The user picks a region today;
 * tax/tipping/refund policy gets layered on later once HANDOFF §9 items
 * are confirmed.
 */
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const FormSchema = z.object({
  name: z.string().trim().min(2, 'Shop name must be at least 2 characters').max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Lowercase letters, numbers, and hyphens only'),
  region: z.enum(['US', 'EU', 'PH']),
  timezone: z.string().trim().min(2).max(64).optional(),
});

export type CreateOrgState = { ok: false; error: string } | { ok: true };

export async function createOrg(_prev: CreateOrgState | null, formData: FormData): Promise<CreateOrgState> {
  const parsed = FormSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    region: formData.get('region'),
    timezone: formData.get('timezone') || undefined,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? 'Invalid form data' };
  }

  const { getToken, userId } = auth();
  if (!userId) return { ok: false, error: 'You must be signed in' };
  const token = await getToken();
  if (!token) return { ok: false, error: 'Could not obtain auth token' };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { ok: false, error: 'API URL not configured' };

  const res = await fetch(`${apiUrl}/api/v1/orgs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, error: body?.message ?? `API error ${res.status}` };
  }

  redirect('/dashboard');
}
