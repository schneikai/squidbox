import * as Clipboard from 'expo-clipboard';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import useHaptics from '@/hooks/useHaptics';

/**
 * Copying a text (one the assistant wrote, a post's, a link): `copy(text, failure?)` puts it on the
 * clipboard, and it's felt. A clipboard that refuses it says "Couldn't copy the text" (with
 * `failure`, what that means here); whether it was copied.
 */
export default function useCopyText() {
  const haptics = useHaptics();

  return useCallback(
    async (text: string, failure?: string): Promise<boolean> => {
      try {
        await Clipboard.setStringAsync(text);
      } catch (error) {
        console.error("Couldn't copy the text", error);
        Alert.alert("Couldn't copy the text", failure);
        return false;
      }
      haptics.success();
      return true;
    },
    [haptics],
  );
}
