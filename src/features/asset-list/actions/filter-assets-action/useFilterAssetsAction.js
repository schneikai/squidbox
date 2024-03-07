import { useState } from 'react';

import { MEDIA_TYPES } from '@/utils/assets/constants';

export default function useFilterAssetsAction({ afterFilter } = {}) {
  const [activeFilter, setActiveFilter] = useState([]);

  function matchFilter(asset) {
    if (activeFilter.length === 0) return true;
    if (activeFilter.includes('favorites') && !asset.isFavorite) return false;
    if (activeFilter.includes('images') && asset.mediaType !== MEDIA_TYPES.IMAGE) return false;
    if (activeFilter.includes('videos') && asset.mediaType !== MEDIA_TYPES.VIDEO) return false;
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
