import { type RefObject, useCallback } from 'react';

import type { ScrollableList } from './useListControls';

/**
 * A list's `ref` that fills `listRef` (useListControls'): a callback, since an object ref of
 * ScrollableList isn't a FlatList's. Without `listRef` it fills nothing.
 */
export default function useListRefCallback(listRef: RefObject<ScrollableList | null> | undefined) {
  return useCallback(
    (list: ScrollableList | null) => {
      if (listRef) listRef.current = list;
    },
    [listRef],
  );
}
