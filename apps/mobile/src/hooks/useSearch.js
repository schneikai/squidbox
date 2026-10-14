import { useState } from 'react';

/**
 * A screen's search text. Plain state on purpose: it controls a text input, and React can't drive a
 * text input from a transition. Filter with `useSearchMode`'s deferred `query` to keep typing smooth.
 * `afterChange` runs on every change, like useSort's `afterSort` (e.g. a paged list resets its depth).
 */
export default function useSearch({ afterChange } = {}) {
  const [searchText, setText] = useState('');

  function setSearchText(text) {
    setText(text);
    if (afterChange) afterChange();
  }

  return { searchText, setSearchText };
}
