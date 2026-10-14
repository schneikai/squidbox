import { useState } from 'react';

/**
 * A screen's search text. Plain state on purpose: it controls a text input, and React can't drive a
 * text input from a transition. Filter with `useSearchMode`'s deferred `query` to keep typing smooth.
 */
export default function useSearch(initialText = '') {
  const [searchText, setSearchText] = useState(initialText);
  return { searchText, setSearchText };
}
