'use client';

import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';

interface Props {
  entity: 'products' | 'customers' | 'orders';
  format?: 'csv' | 'json';
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function ExportButton({ entity, format = 'csv' }: Props) {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/v1/exports`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ entity, format }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `export failed (${res.status})`);
      }
      const job = (await res.json()) as { url: string; filename: string };
      const downloadRes = await fetch(`${baseUrl}${job.url}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!downloadRes.ok) throw new Error(`download failed (${downloadRes.status})`);
      const blob = await downloadRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = job.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-lg border border-line-2 bg-surface px-4 py-2 text-sm text-ink hover:bg-surface-2 disabled:opacity-50"
      >
        {busy ? 'Exporting…' : `Export ${format.toUpperCase()}`}
      </button>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
