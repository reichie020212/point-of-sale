/**
 * Registers — live device list.
 *
 * Reads the org's devices from the API. The "live" pulse comes from a
 * client-side WebSocket subscription (added in M12 once tier gating
 * is wired). For now devices show their last-seen timestamp.
 */
import { api } from '../../../../lib/api';

interface DeviceRow {
  id: string;
  name: string;
  model: string | null;
  status: 'live' | 'offline' | 'revoked';
  lastIp: string | null;
  lastSeenAt: string | null;
}

export default async function RegistersPage() {
  let devices: DeviceRow[] = [];
  let error: string | null = null;
  try {
    // TODO(M12): /api/v1/devices endpoint lands with the tier gating
    // commit. For now this returns an empty array since the route
    // isn't wired yet — the page renders the empty state.
    const res = await api<{ devices: DeviceRow[] }>('/api/v1/devices').catch(() => ({
      devices: [] as DeviceRow[],
    }));
    devices = res.devices;
  } catch (err) {
    error = err instanceof Error ? err.message : 'unknown error';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Registers</h1>
          <p className="mt-1 text-sm text-ink-2">
            {devices.length} device{devices.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-line-2 bg-surface px-4 py-2 text-sm text-ink hover:bg-surface-2"
        >
          Pair new device
        </button>
      </header>

      {error ? (
        <div className="rounded-xl border border-bad bg-surface p-4 text-bad">{error}</div>
      ) : devices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-2 bg-surface p-12 text-center">
          <p className="text-ink-2">No devices paired yet.</p>
          <p className="mt-2 font-mono text-xs text-ink-3">
            Pairing flow lands in M12 with tier gating.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {devices.map((d) => (
            <li
              key={d.id}
              className="rounded-2xl border border-line bg-surface p-5 shadow-card"
            >
              <header className="flex items-center justify-between">
                <span className="font-medium text-ink">{d.name}</span>
                <StatusPill status={d.status} />
              </header>
              <p className="mt-1 text-xs text-ink-3">{d.model ?? 'unknown model'}</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-ink-3">Last IP</dt>
                <dd className="font-mono tabular text-ink-2">{d.lastIp ?? '—'}</dd>
                <dt className="text-ink-3">Last seen</dt>
                <dd className="font-mono tabular text-ink-2">
                  {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : 'never'}
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: DeviceRow['status'] }) {
  const cls =
    status === 'live'
      ? 'bg-accent-soft text-accent-deep'
      : status === 'revoked'
        ? 'bg-surface-2 text-bad'
        : 'bg-surface-2 text-ink-3';
  return (
    <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
  );
}
