import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, space } from '@/styles/designTokens';

/**
 * The props of a picker sheet's list under its SheetSearchField, for any list (ScrollView, FlatList,
 * SectionList): the field already clears the ModalHeader, so the list keeps a small gap under it and
 * the bottom safe area; `hasGutter` adds the screen's side gutter, for a list of cards. A tap on a row
 * goes through while the keyboard is up, a drag dismisses it, and the keyboard's height is inset so the
 * last rows scroll into view. The same object across renders, so a keystroke doesn't re-render the list.
 */
export default function useSheetSearchList({ hasGutter = false }: { hasGutter?: boolean } = {}) {
  const { bottom } = useSafeAreaInsets();

  return useMemo(
    () =>
      ({
        contentContainerStyle: {
          paddingTop: space.md,
          paddingBottom: bottom + layout.contentEnd,
          paddingHorizontal: hasGutter ? layout.sideGutter : 0,
        },
        automaticallyAdjustKeyboardInsets: true,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'on-drag',
      }) as const,
    [bottom, hasGutter],
  );
}
