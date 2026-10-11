import { useDeferredValue, useState } from 'react';

/**
 * Open/closed state of a screen's search bar, on top of that screen's own search text.
 *
 * Search counts as active while the bar is open or a query is set (for example a posts query set
 * from another screen), so a query never filters a list without being visible. Cancel clears it.
 *
 * Returns `searchBar`, the props SearchOptionsBar expects, and `query`, a deferred copy of the text
 * for filtering, so typing stays responsive on large lists.
 */
export default function useSearchMode({ searchText, setSearchText }) {
  const [isOpen, setIsOpen] = useState(false);
  const query = useDeferredValue(searchText);

  const searchBar = {
    isSearchActive: isOpen || searchText !== '',
    searchText,
    onOpenSearch: () => setIsOpen(true),
    onCloseSearch: () => {
      setIsOpen(false);
      setSearchText('');
    },
    onChangeSearch: setSearchText,
  };

  return { searchBar, query };
}
