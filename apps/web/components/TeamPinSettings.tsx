'use client';

/**
 * Team PIN settings.
 *
 * Lists every user in the active org with a "Set PIN" / "Clear PIN"
 * action. PIN entry is a 4-digit input; submission PUTs the new PIN
 * to the server, which hashes it and bumps the user's sync version
 * so connected mobile devices pick the change up on next PULL.
 *
 * For owner/manager only — the API gates the PUT, so non-owners
 * see the form but get a 403 on submit.
 */
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TeamUser {
  id: string;
  email: string;
  name: string | null;
  role: 'owner' | 'manager' | 'cashier';
  hasPin: boolean;
}

interface Props {
  team: TeamUser[];
}

export function TeamPinSettings({ team }: Props) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const [pinDraft, setPinDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (team.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-3">
        No teammates yet. Invite users from the Clerk dashboard.
      </p>
    );
  }

  async function call(userId: string, body: { pin: string | null }) {
    const token = await getToken();
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/pin`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 204) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message ?? `request failed (${res.status})`);
    }
  }

  async function onSubmit(userId: string) {
    setError(null);
    const pin = (pinDraft[userId] ?? '').trim();
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    setBusy(true);
    try {
      await call(userId, { pin });
      setPinDraft((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setPendingFor(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  async function onClear(userId: string) {
    setError(null);
    setBusy(true);
    try {
      await call(userId, { pin: null });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {team.map((user) => {
        const editing = pendingFor === user.id;
        return (
          <div
            key={user.id}
            className="flex flex-col gap-3 rounded-xl border border-line p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-ink">{user.name ?? user.email}</p>
              <p className="text-xs text-ink-3">
                {user.role} · {user.hasPin ? 'PIN set' : 'no PIN'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    value={pinDraft[user.id] ?? ''}
                    onChange={(e) =>
                      setPinDraft((prev) => ({
                        ...prev,
                        [user.id]: e.target.value.replace(/\D/g, '').slice(0, 4),
                      }))
                    }
                    placeholder="••••"
                    className="w-24 rounded-lg border border-line-2 bg-surface px-3 py-1.5 font-mono tabular text-ink outline-none focus:border-accent-deep"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void onSubmit(user.id);
                    }}
                    disabled={busy}
                    className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-bg hover:bg-ink-2 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFor(null);
                      setError(null);
                    }}
                    disabled={busy}
                    className="text-xs text-ink-3 hover:text-ink"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFor(user.id);
                      setError(null);
                    }}
                    disabled={busy}
                    className="rounded-lg border border-line-2 px-3 py-1.5 text-xs text-ink hover:bg-surface-2 disabled:opacity-50"
                  >
                    {user.hasPin ? 'Change PIN' : 'Set PIN'}
                  </button>
                  {user.hasPin && (
                    <button
                      type="button"
                      onClick={() => {
                        void onClear(user.id);
                      }}
                      disabled={busy}
                      className="text-xs text-bad hover:underline disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
