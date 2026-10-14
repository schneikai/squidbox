import { useState } from 'react';

/** A screen's active filter keys. Returns { activeFilter, toggleFilter }; `afterFilter` runs on every change. */
export default function useFilter({ afterFilter } = {}) {
  const [activeFilter, setActiveFilter] = useState([]);

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

  return { activeFilter, toggleFilter };
}
