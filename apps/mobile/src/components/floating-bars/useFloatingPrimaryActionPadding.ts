import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/styles/designTokens';

/** The bottom padding of a scroll view's content under a FloatingPrimaryAction. */
export default function useFloatingPrimaryActionPadding() {
  const { bottom } = useSafeAreaInsets();
  return bottom + layout.barClearance;
}
