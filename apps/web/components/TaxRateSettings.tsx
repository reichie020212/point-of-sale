'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  current: string;
}

export function TaxRateSettings({ current }: Props) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [rate, setRate] = useState(current);
  const [status, setStatus] = useState<
    | { state: 'idle' }
    | { state: 'saving' }
    | { state: 'saved' }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rate === current) return;
    setStatus({ state: 'saving' });
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/v1/orgs/active`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ taxRate: rate }),
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
        <span className="block text-xs text-ink-3">Rate (percent)</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            pattern="^\d{1,2}(\.\d{1,3})?$"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="block w-32 rounded-lg border border-line-2 bg-surface px-3 py-2 font-mono tabular text-ink outline-none focus:border-accent-deep"
          />
          <span className="font-mono tabular text-ink-3">%</span>
        </div>
      </label>
      <button
        type="submit"
        disabled={rate === current || status.state === 'saving'}
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
