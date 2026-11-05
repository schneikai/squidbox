import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useDerivedValue } from 'react-native-reanimated';

/**
 * The keyboard's height, live (a Reanimated derived value): 0 while it's down. On iOS it includes the
 * bottom safe area. react-native-keyboard-controller reports it as a negative offset (how far to move
 * content up); this turns it into the height.
 */
export default function useKeyboardHeight() {
  const { height } = useReanimatedKeyboardAnimation();
  return useDerivedValue(() => -height.value);
}
