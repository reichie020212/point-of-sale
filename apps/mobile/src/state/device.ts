/**
 * Paired-device identity slice.
 *
 * Mirrors what the API hands back from POST /api/v1/devices/pair so
 * settings and checkout can show the device name and stamp orders
 * with the real `device_id`. The token itself stays in
 * expo-secure-store; this slice mirrors the non-sensitive metadata
 * to/from the same secure store under a separate key so it survives
 * app restarts.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const IDENTITY_KEY = 'counter.deviceIdentity';

export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
  orgId: string;
}

interface DeviceState {
  identity: DeviceIdentity | null;
  set: (identity: DeviceIdentity | null) => void;
  /** Read the stored identity into the slice on app boot. */
  hydrate: () => Promise<void>;
}

export const useDevice = create<DeviceState>((set) => ({
  identity: null,
  set: (identity) => {
    void persist(identity);
    set({ identity });
  },
  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(IDENTITY_KEY);
    if (!raw) return;
    try {
      set({ identity: JSON.parse(raw) as DeviceIdentity });
    } catch {
      // Corrupt entry — drop silently and let the user re-pair.
      await SecureStore.deleteItemAsync(IDENTITY_KEY);
    }
  },
}));

async function persist(identity: DeviceIdentity | null): Promise<void> {
  if (identity) {
    await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(identity));
  } else {
    await SecureStore.deleteItemAsync(IDENTITY_KEY);
  }
}
