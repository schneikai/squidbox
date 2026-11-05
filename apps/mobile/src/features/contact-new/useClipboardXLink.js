import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import parseXProfileUrl from './parseXProfileUrl';

/**
 * The X profile link on the clipboard (parseXProfileUrl's `{ handle, url }`), read each time the
 * screen comes into focus, or null when the clipboard holds none. Only a clipboard that holds a URL
 * is read, and only on iOS (hasUrlAsync is iOS's: elsewhere it warns and nothing is offered).
 */
export default function useClipboardXLink() {
  const [link, setLink] = useState(null);

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

  return link;
}
