import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import parseXProfileUrl, { type XProfileLink } from './parseXProfileUrl';

/**
 * The X profile link on the clipboard (parseXProfileUrl's `{ handle, url }`): `link`, read each
 * time the screen comes into focus, or null when the clipboard holds none. Only a clipboard that
 * holds a URL is read then, and only on iOS (hasUrlAsync is iOS's: elsewhere it warns), so the
 * system doesn't ask to paste before the user did anything. `readAsync()` reads it on a tap,
 * anywhere: the link, or null.
 */
export default function useClipboardXLink(): {
  link: XProfileLink | null;
  readAsync: () => Promise<XProfileLink | null>;
} {
  const [link, setLink] = useState<XProfileLink | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'ios') return undefined;
      let isCancelled = false;
      (async () => {
        try {
          if (!(await Clipboard.hasUrlAsync())) {
            if (!isCancelled) setLink(null);
            return;
          }
          const text = await Clipboard.getStringAsync();
          if (!isCancelled) setLink(parseXProfileUrl(text));
        } catch (error) {
          console.warn('Could not read the clipboard', error);
        }
      })();
      return () => {
        isCancelled = true;
      };
    }, []),
  );

  async function readAsync() {
    const read = parseXProfileUrl(await Clipboard.getStringAsync());
    setLink(read);
    return read;
  }

  return { link, readAsync };
}
