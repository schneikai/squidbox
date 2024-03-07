import { useState } from 'react';

export default function useFilterPostsAction({ afterFilter } = {}) {
  const [activeFilter, setActiveFilter] = useState([]);

  function matchFilter(post) {
    if (activeFilter.length === 0) return true;
    if (activeFilter.includes('favorites') && !post.isFavorite) return false;
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
