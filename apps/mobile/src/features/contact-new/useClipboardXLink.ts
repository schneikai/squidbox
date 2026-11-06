import * as Clipboard from 'expo-clipboard';

import parseXProfileUrl, { type XProfileLink } from './parseXProfileUrl';

/**
 * Reads the X profile link on the clipboard on a tap (parseXProfileUrl's `{ handle, url }`), or
 * null when it holds none. Only on a tap, so the system's paste prompt follows what the user did.
 */
export default function useClipboardXLink(): { readAsync: () => Promise<XProfileLink | null> } {
  async function readAsync() {
    return parseXProfileUrl(await Clipboard.getStringAsync());
  }

  return { readAsync };
}
