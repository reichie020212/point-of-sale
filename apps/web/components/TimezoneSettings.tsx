'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  current: string;
}

export function TimezoneSettings({ current }: Props) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [tz, setTz] = useState(current);
  const [zones, setZones] = useState<string[]>([]);
  const [status, setStatus] = useState<
    | { state: 'idle' }
    | { state: 'saving' }
    | { state: 'saved' }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  useEffect(() => {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === 'function') {
      setZones(intl.supportedValuesOf('timeZone'));
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (tz === current) return;
    setStatus({ state: 'saving' });
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/v1/orgs/active`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ timezone: tz }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `update failed (${res.status})`);
      }
      setStatus({ state: 'saved' });
      router.refresh();
    } catch (err) {
      setStatus({
        state: 'error',
        message: err instanceof Error ? err.message : 'unknown error',
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex items-end gap-3">
      <label className="flex-1">
        <span className="block text-xs text-ink-3">IANA zone</span>
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-ink outline-none focus:border-accent-deep"
        >
          {zones.length === 0 ? (
            <option value={tz}>{tz}</option>
          ) : (
            zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))
          )}
        </select>
      </label>
      <button
        type="submit"
        disabled={tz === current || status.state === 'saving'}
        className="rounded-lg bg-ink px-4 py-2 text-sm text-bg shadow-card hover:bg-ink-2 disabled:opacity-50"
      >
        {status.state === 'saving' ? 'Saving…' : 'Save'}
      </button>
      {status.state === 'saved' && (
        <span className="text-xs text-accent-deep">Saved.</span>
      )}
      {status.state === 'error' && (
        <span className="text-xs text-bad">{status.message}</span>
      )}
    </form>
  );
}
