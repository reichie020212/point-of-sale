/**
 * Registers — live device list.
 *
 * Reads the org's devices from `/api/v1/devices` and per-device sync
 * health from `/api/v1/sync/status`, then merges them by id. The
 * sync row is the source of truth for `lastSeenAt`, `lag`, and
 * `freshness`; the devices row carries pairing state and metadata.
 */
import { PairDeviceButton } from '../../../../components/PairDeviceButton';
import { api } from '../../../../lib/api';

interface DeviceRow {
  id: string;
  name: string;
  model: string | null;
  status: 'live' | 'offline' | 'revoked';
  lastIp: string | null;
  lastSeenAt: string | null;
  pairingActive: boolean;
}

interface SyncDeviceRow {
  id: string;
  lastSeenAt: string | null;
  lastSeenVersion: string;
  lag: string;
  lastIp: string | null;
  freshness: 'live' | 'stale' | 'offline';
}

interface SyncStatusResponse {
  orgVersion: string;
  queuedOps: number;
  devices: SyncDeviceRow[];
}

export default async function RegistersPage() {
  let devices: DeviceRow[] = [];
  let sync: SyncStatusResponse | null = null;
  let error: string | null = null;
  try {
    const [devicesRes, syncRes] = await Promise.all([
      api<{ devices: DeviceRow[] }>('/api/v1/devices'),
      api<SyncStatusResponse>('/api/v1/sync/status'),
    ]);
    devices = devicesRes.devices;
    sync = syncRes;
  } catch (err) {
    error = err instanceof Error ? err.message : 'unknown error';
  }

  const syncById = new Map<string, SyncDeviceRow>();
  for (const s of sync?.devices ?? []) syncById.set(s.id, s);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Registers</h1>
          <p className="mt-1 text-sm text-ink-2">
            {devices.length} device{devices.length === 1 ? '' : 's'}
            {sync && (
              <>
                {' · '}
                <span className="font-mono tabular">
                  org v{sync.orgVersion}
                </span>
                {' · '}
                {sync.queuedOps} queued op{sync.queuedOps === 1 ? '' : 's'}
              </>
            )}
          </p>
        </div>
        <PairDeviceButton />
      </header>

      {error ? (
        <div className="rounded-xl border border-bad bg-surface p-4 text-bad">{error}</div>
      ) : devices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 bg-surface p-12 text-center">
          <p className="text-ink-2">No devices paired yet.</p>
          <p className="mt-2 font-mono text-xs text-ink-3">
            Pair a register from the mobile app to see it here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {devices.map((d) => {
            const s = syncById.get(d.id);
            return (
              <li
                key={d.id}
                className="rounded-2xl border border-line bg-surface p-5 shadow-card"
              >
                <header className="flex items-center justify-between">
                  <span className="font-medium text-ink">{d.name}</span>
                  <StatusPill
                    status={d.status}
                    pairingActive={d.pairingActive}
                    freshness={s?.freshness}
                  />
                </header>
                <p className="mt-1 text-xs text-ink-3">
                  {d.pairingActive ? 'Awaiting first pair' : (d.model ?? 'unknown model')}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
                  <dt className="text-ink-3">Last seen</dt>
                  <dd className="font-mono tabular text-ink-2">
                    {s?.lastSeenAt
                      ? formatRelative(s.lastSeenAt)
                      : d.lastSeenAt
                        ? formatRelative(d.lastSeenAt)
                        : 'never'}
                  </dd>
                  <dt className="text-ink-3">Lag</dt>
                  <dd className="font-mono tabular text-ink-2">
                    {s ? `${s.lag} update${s.lag === '1' ? '' : 's'}` : '—'}
                  </dd>
                  <dt className="text-ink-3">Last IP</dt>
                  <dd className="font-mono tabular text-ink-2">
                    {s?.lastIp ?? d.lastIp ?? '—'}
                  </dd>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusPill({
  status,
  pairingActive,
  freshness,
}: {
  status: DeviceRow['status'];
  pairingActive: boolean;
  freshness?: 'live' | 'stale' | 'offline';
}) {
  if (pairingActive) {
    return (
      <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2">
        pairing
      </span>
    );
  }
  if (status === 'revoked') {
    return (
      <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs font-medium text-bad">
        revoked
      </span>
    );
  }
  // Once paired, freshness from sync_status is more honest than the
  // stored `status` enum (which only flips on pair/revoke).
  const fresh = freshness ?? 'offline';
  const cls =
    fresh === 'live'
      ? 'bg-accent-soft text-accent-deep'
      : fresh === 'stale'
        ? 'bg-surface-2 text-ink-2'
        : 'bg-surface-2 text-ink-3';
  return (
    <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${cls}`}>{fresh}</span>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}
