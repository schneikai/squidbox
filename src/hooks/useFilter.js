import { useState } from 'react';

/**
 * Generic filter hook.
 * matchFn(item, activeFilter) should return true if the item passes the filter.
 * Returns { activeFilter, matchFilter, toggleFilter }.
 */
export default function useFilter(matchFn, { afterFilter } = {}) {
  const [activeFilter, setActiveFilter] = useState([]);

  function matchFilter(item) {
    if (activeFilter.length === 0) return true;
    return matchFn(item, activeFilter);
  }

  function toggleFilter(filter) {
    if (filter === 'all') {
      setActiveFilter([]);
    } else {
      setActiveFilter((current) => {
        if (current.includes(filter)) return current.filter((f) => f !== filter);
        return [...current, filter];
      });
    }
    if (afterFilter) afterFilter();
  }

  return { activeFilter, matchFilter, toggleFilter };
}
