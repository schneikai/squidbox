import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, sizes, space } from '@/styles/designTokens';

// The room a screen's content keeps free at the bottom for a FloatingPrimaryAction, like the
// floating bars' clearances.
const CLEARANCE = sizes.iconButton + layout.barBottom * 2 + space.lg;

/** The bottom padding of a scroll view's content under a FloatingPrimaryAction. */
export default function useFloatingPrimaryActionPadding() {
  const { bottom } = useSafeAreaInsets();
  return bottom + CLEARANCE;
}
