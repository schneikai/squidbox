import { useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useKeyboardHeight from '@/hooks/useKeyboardHeight';

/**
 * How far above the screen's bottom edge content stays clear, live (a Reanimated derived value, for
 * an animated style): the keyboard's height while it's up, the bottom safe area otherwise, plus
 * `gap`. The keyboard's height on iOS includes the bottom safe area, so the two never add up.
 */
export default function useKeyboardInset(gap: number = 0) {
  const { bottom } = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  return useDerivedValue(() => Math.max(bottom, keyboardHeight.value) + gap, [bottom, gap]);
}
