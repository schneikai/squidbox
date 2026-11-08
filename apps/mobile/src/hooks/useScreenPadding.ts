import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/styles/designTokens';

/**
 * Returns consistent top/bottom content padding for the screen types.
 * 'main'   — tab screens: content sits under the floating header and above the floating bars
 * 'detail' — stack screens: content sits under the floating detail header
 * 'sheet'  — a sheet's content: under its ModalHeader, and above the bottom safe area (a sheet with a
 *            FloatingPrimaryAction takes its bottom from useFloatingPrimaryActionPadding instead)
 * 'sheet-bar' — a sheet's content above the floating search bar at its bottom (SearchSortFilterBar)
 */
export default function useScreenPadding(type: 'main' | 'detail' | 'sheet' | 'sheet-bar' = 'main'): {
  paddingTop: number;
  paddingBottom: number;
} {
  const insets = useSafeAreaInsets();

  if (type === 'sheet-bar') {
    return {
      paddingTop: layout.sheetContentTop,
      paddingBottom: insets.bottom + layout.barClearance,
    };
  }

  if (type === 'sheet') {
    return {
      paddingTop: layout.sheetContentTop,
      paddingBottom: insets.bottom + layout.contentEnd,
    };
  }

  if (type === 'detail') {
    return {
      paddingTop: insets.top + layout.contentTop,
      paddingBottom: insets.bottom + layout.contentEnd,
    };
  }

  return {
    paddingTop: insets.top + layout.contentTop,
    paddingBottom: insets.bottom + layout.contentBottom,
  };
}
