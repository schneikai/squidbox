import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/styles/designTokens';

export type ScreenPaddingOptions = {
  /**
   * The screen floats bars or an action over the bottom of its content (a search + options bar, a
   * FloatingPrimaryAction): the content ends above them, so its last row comes to rest in full view
   * instead of only peeking out while the list is pulled. The main tabs always have them.
   */
  bottomBar?: boolean;
};

/**
 * Returns consistent top/bottom content padding for the three screen types.
 * 'main'   — tab screens: content sits under the floating header and above the floating bars
 * 'detail' — stack screens: content sits under the floating detail header
 * 'sheet'  — a sheet's content: under its ModalHeader
 * Without bottom bars the content ends above the bottom safe area.
 */
export default function useScreenPadding(
  type: 'main' | 'detail' | 'sheet' = 'main',
  { bottomBar = type === 'main' }: ScreenPaddingOptions = {},
): {
  paddingTop: number;
  paddingBottom: number;
} {
  const insets = useSafeAreaInsets();

  return {
    paddingTop: type === 'sheet' ? layout.sheetContentTop : insets.top + layout.contentTop,
    paddingBottom: insets.bottom + (bottomBar ? layout.barClearance : layout.contentEnd),
  };
}
