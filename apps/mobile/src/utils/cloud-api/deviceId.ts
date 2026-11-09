import { getItemAsync, setItemAsync } from './secureStorage';

import getNewItemId from '@/utils/getNewItemId';

// This install's id, minted once and kept in secure storage on this device only (no backup or new
// iPhone carries it over): the install every request names (clientHeader). The server ignores it for
// now (todo.md, docs/sync-design.md §15). Null when it couldn't be read or stored: no header then.
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
  await setItemAsync(KEY, minted, { thisDeviceOnly: true });
  deviceId = minted;
}

/** The install's id, or null before the boot loaded it. */
export function getDeviceId(): string | null {
  return deviceId;
}
