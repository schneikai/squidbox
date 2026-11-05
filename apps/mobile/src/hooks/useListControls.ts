import { useDeferredValue, useRef, useState } from 'react';

import type { SearchBarState } from '@/components/floating-bars/SearchOptionsBar';
import toggleItem from '@/utils/toggleItem';

// The one method of a list this calls: FlatList's, FlashList's or an animated one's alike.
export type ScrollableList = { scrollToOffset(params: { animated: boolean; offset: number }): void };

/**
 * A list screen's search, sort and filter, for its SearchSortFilterBar:
 *   - `listRef`, for the list: a new sort or filter jumps it back to its top;
 *   - `sortOrder` and `sort`, starting at `defaultSort`; a screen whose sort outlives it keeps its own and
 *     passes `onSort`, which `sort` then calls instead;
 *   - `activeFilter` (filter keys) and `toggleFilter` ('all' clears them);
 *   - `searchBar`, the props SearchOptionsBar expects, and `searchText`, a deferred copy of the typed
 *     text for filtering, so typing stays smooth on large lists.
 */
export default function useListControls<Sort = string>({
  defaultSort,
  onSort,
}: { defaultSort?: Sort; onSort?: (order: Sort) => void } = {}) {
  const listRef = useRef<ScrollableList>(null);
  const [sortOrder, setSortOrder] = useState(defaultSort);
  const [activeFilter, setActiveFilter] = useState<string[]>([]);
  // Plain state on purpose: it controls a text input, and React can't drive one from a transition.
  const [typedText, setTypedText] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchText = useDeferredValue(typedText);

  // Not animated: the new first page lands at the top, where an animated scroll would still be passing
  // the end of the shorter list and load a second page early.
  function listScrollTop() {
    listRef.current!.scrollToOffset({ animated: false, offset: 0 });
  }

  function sort(order: Sort) {
    (onSort ?? setSortOrder)(order);
    listScrollTop();
  }

  function toggleFilter(filter: string) {
    if (filter === 'all') {
      setActiveFilter([]);
    } else {
      setActiveFilter((current) => toggleItem(current, filter));
    }
    listScrollTop();
  }

  // Search counts as active while the bar is open or text is set, so text never filters a list
  // without showing. Cancel clears it.
  const searchBar: SearchBarState = {
    isSearchActive: isSearchOpen || typedText !== '',
    searchText: typedText,
    onOpenSearch: () => setIsSearchOpen(true),
    onCloseSearch: () => {
      setIsSearchOpen(false);
      setTypedText('');
    },
    onChangeSearch: setTypedText,
  };

  return { listRef, sortOrder, sort, activeFilter, toggleFilter, searchBar, searchText };
}
