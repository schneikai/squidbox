import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, sizes } from '@/styles/designTokens';

// The room a screen's content keeps free at the bottom for a FloatingPrimaryAction, like the
// floating bars' clearances.
const CLEARANCE = sizes.primaryButton + layout.barBottom * 2 + 16;

/** The bottom padding of a scroll view's content under a FloatingPrimaryAction. */
export default function useFloatingPrimaryActionPadding() {
  const { bottom } = useSafeAreaInsets();
  return bottom + CLEARANCE;
}
