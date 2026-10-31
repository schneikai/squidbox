import * as Clipboard from 'expo-clipboard';
import { useCallback } from 'react';

import useHaptics from '@/hooks/useHaptics';

/** Copying a text the assistant wrote: `copy(text)` puts it on the clipboard, and it's felt. */
export default function useCopyText() {
  const haptics = useHaptics();

  return useCallback(
    async (text) => {
      await Clipboard.setStringAsync(text);
      haptics.success();
    },
    [haptics],
  );
}
