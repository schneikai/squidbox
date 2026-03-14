import { useState } from 'react';

/**
 * Generic sort hook. sortOptions is a map of sortOrder string → comparator function.
 * Returns { sortOrder, sortFunction, sort }.
 */
export default function useSort(sortOptions, defaultSortOrder, { afterSort } = {}) {
  const [sortOrder, setSortOrder] = useState(defaultSortOrder);
  const [sortFunction, setSortFunction] = useState(() => sortOptions[defaultSortOrder]);

  function sort(order) {
    setSortOrder(order);
    setSortFunction(() => sortOptions[order]);
    if (afterSort) afterSort();
  }

  return { sortOrder, sortFunction, sort };
}
