'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function ImportButton() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [status, setStatus] = useState<
    | { state: 'idle' }
    | { state: 'uploading' }
    | { state: 'done'; summary: ImportSummary }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus({ state: 'uploading' });
    try {
      const token = await getToken();
      const text = await file.text();
      const res = await fetch(`${baseUrl}/api/v1/imports/products`, {
        method: 'POST',
        headers: {
          'content-type': 'text/csv',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: text,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `import failed (${res.status})`);
      }
      const summary = (await res.json()) as ImportSummary;
      setStatus({ state: 'done', summary });
      router.refresh();
    } catch (err) {
      setStatus({ state: 'error', message: err instanceof Error ? err.message : 'unknown error' });
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="cursor-pointer rounded-lg border border-line-2 bg-surface px-4 py-2 text-sm text-ink hover:bg-surface-2">
        {status.state === 'uploading' ? 'Importing…' : 'Import CSV'}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onChange}
          disabled={status.state === 'uploading'}
        />
      </label>
      {status.state === 'done' && (
        <p className="font-mono text-xs tabular text-ink-3">
          +{status.summary.inserted} inserted, {status.summary.skipped} skipped
          {status.summary.errors.length > 0 && `, ${status.summary.errors.length} errors`}
        </p>
      )}
      {status.state === 'error' && <p className="text-xs text-bad">{status.message}</p>}
    </div>
  );
}
