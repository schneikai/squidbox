import { useState } from 'react';

export default function useFilterAlbumsAction({ afterFilter } = {}) {
  const [activeFilter, setActiveFilter] = useState([]);

  function matchFilter(asset) {
    if (activeFilter.length === 0) return true;
    if (activeFilter.includes('starred') && !asset.isFavorite) return false;
    if (activeFilter.includes('archived') && !asset.archivedAt) return false;
    return true;
  }

  function toggleFilter(filter) {
    if (filter === 'all') {
      setActiveFilter([]);
    } else {
      setActiveFilter((curentFilter) => {
        if (curentFilter.includes(filter)) {
          return curentFilter.filter((f) => f !== filter);
        } else {
          return [...curentFilter, filter];
        }
      });
    }
    if (afterFilter) afterFilter();
  }

  return {
    activeFilter,
    matchFilter,
    toggleFilter,
  };
}
