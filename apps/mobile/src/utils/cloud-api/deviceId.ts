import { getItemAsync, setItemAsync } from './secureStorage';

import getNewItemId from '@/utils/getNewItemId';

// This install's id, minted once and kept in secure storage: the device every request names
// (clientHeader), which the server records per account (docs/sync-design.md §15).
const KEY = 'deviceId';
let deviceId: string | null = null;

/** Reads the install's id, or mints and stores it on the first launch. Called by the boot. */
export async function loadDeviceIdAsync(): Promise<void> {
  const stored = await getItemAsync(KEY);
  if (stored) {
    deviceId = stored;
    return;
  }
  const minted = getNewItemId();
  await setItemAsync(KEY, minted);
  deviceId = minted;
}

/** The install's id, or null before the boot loaded it. */
export function getDeviceId(): string | null {
  return deviceId;
}
