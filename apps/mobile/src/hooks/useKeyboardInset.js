import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How far above the screen's bottom edge content stays clear, live (a Reanimated derived value, for
 * an animated style): the keyboard's height while it's up, the bottom safe area otherwise, plus
 * `gap`. The keyboard's height on iOS includes the bottom safe area, so the two never add up.
 */
export default function useKeyboardInset(gap = 0) {
  const { bottom } = useSafeAreaInsets();
  // react-native-keyboard-controller reports the height as a negative offset (how far to move up).
  const { height } = useReanimatedKeyboardAnimation();
  return useDerivedValue(() => Math.max(bottom, -height.value) + gap, [bottom, gap]);
}
