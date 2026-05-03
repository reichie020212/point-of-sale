'use client';

/**
 * Owner-controlled telemetry opt-out toggle.
 *
 * Gates PostHog product analytics only — Sentry crash reporting
 * stays on regardless because events are PII-scrubbed at the SDK
 * boundary. The settings copy says so explicitly so the user is
 * never surprised.
 *
 * The toggle PATCHes `/api/v1/orgs/active`; on success the orgs-on-
 * sync EVENT loop fans the flip out to every paired register, where
 * `useOrgSettings` calls `posthog.optOut()` reactively.
 */
import { useState } from 'react';

interface Props {
  /** Current persisted value from the org row. */
  current: boolean;
}

export function TelemetrySettings({ current }: Props) {
  const [enabled, setEnabled] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    const next = !enabled;
    setBusy(true);
    setError(null);
    setEnabled(next); // optimistic
    try {
      const res = await fetch('/api/v1/orgs/active', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telemetryEnabled: next }),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `request failed (${res.status})`);
      }
    } catch (err) {
      setEnabled(current); // rollback
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex items-start gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Enable product analytics"
        onClick={onToggle}
        disabled={busy}
        className={
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ' +
          (enabled ? 'bg-ink' : 'bg-line-2') +
          (busy ? ' opacity-50' : '')
        }
      >
        <span
          className={
            'inline-block h-5 w-5 transform rounded-full bg-bg shadow transition ' +
            (enabled ? 'translate-x-5' : 'translate-x-0.5')
          }
        />
      </button>
      <div className="flex-1 text-sm">
        <p className="text-ink">
          {enabled ? 'Product analytics enabled' : 'Product analytics off'}
        </p>
        <p className="mt-1 text-xs text-ink-3">
          Counter uses anonymous usage data to figure out which features
          shops actually rely on. Crash reports stay on either way — they
          never include your customers, products, or sales.
        </p>
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </div>
    </div>
  );
}
