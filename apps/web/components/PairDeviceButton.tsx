'use client';

import { useAuth } from '@clerk/nextjs';
import { resolveColor } from '@counter/tokens';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

interface PairingResponse {
  device: { id: string; name: string };
  pairing: { code: string; expiresAt: string; ttlMs: number };
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Status =
  | { state: 'idle' }
  | { state: 'requesting' }
  | { state: 'showing'; code: string; expiresAt: number }
  | { state: 'expired'; code: string }
  | { state: 'error'; message: string };

export function PairDeviceButton() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status.state !== 'showing') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status.state]);

  useEffect(() => {
    if (status.state !== 'showing') return;
    if (status.expiresAt <= Date.now()) {
      setStatus({ state: 'expired', code: status.code });
    }
  }, [status, tick]);

  async function requestCode() {
    setStatus({ state: 'requesting' });
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/v1/devices/code`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `request failed (${res.status})`);
      }
      const data = (await res.json()) as PairingResponse;
      setStatus({
        state: 'showing',
        code: data.pairing.code,
        expiresAt: new Date(data.pairing.expiresAt).getTime(),
      });
      router.refresh();
    } catch (err) {
      setStatus({
        state: 'error',
        message: err instanceof Error ? err.message : 'unknown error',
      });
    }
  }

  function close() {
    setStatus({ state: 'idle' });
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={requestCode}
        disabled={status.state === 'requesting'}
        className="rounded-lg border border-line-2 bg-surface px-4 py-2 text-sm text-ink hover:bg-surface-2 disabled:opacity-50"
      >
        {status.state === 'requesting' ? 'Requesting…' : 'Pair new device'}
      </button>

      {(status.state === 'showing' || status.state === 'expired') && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-2xl text-ink">Pair a device</h2>
            <p className="mt-2 text-sm text-ink-2">
              Open the Counter app on the unpaired phone, tap{' '}
              <span className="text-ink">Pair device</span>, and scan this code. Or enter
              the 12 characters below by hand.
            </p>
            {status.state === 'showing' && (
              <div className="mt-6 flex justify-center">
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <QRCodeSVG
                    value={status.code}
                    size={200}
                    level="M"
                    bgColor="transparent"
                    fgColor={resolveColor('ink', 'hex')}
                  />
                </div>
              </div>
            )}
            <p
              className="mt-6 select-all text-center font-mono text-2xl tabular tracking-wider text-ink"
              aria-live="polite"
            >
              {status.code}
            </p>
            {status.state === 'showing' ? (
              <p className="mt-4 text-center font-mono text-xs tabular text-ink-3">
                Expires in {formatRemaining(status.expiresAt - Date.now())}
              </p>
            ) : (
              <p className="mt-4 text-center text-xs text-bad">
                Code expired. Close and request another.
              </p>
            )}
            <button
              type="button"
              onClick={close}
              className="mt-8 w-full rounded-lg border border-line-2 bg-surface-2 px-4 py-2 text-sm text-ink hover:bg-surface"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {status.state === 'error' && (
        <p className="ml-3 text-xs text-bad">{status.message}</p>
      )}
    </>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
