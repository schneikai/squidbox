import { useState } from 'react';

/** A screen's sort order key. Returns { sortOrder, sort }; `afterSort` runs on every change. */
export default function useSort(defaultSortOrder, { afterSort } = {}) {
  const [sortOrder, setSortOrder] = useState(defaultSortOrder);

  function sort(order) {
    setSortOrder(order);
    if (afterSort) afterSort();
  }

  return { sortOrder, sort };
}
