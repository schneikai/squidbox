import type { FilterOption } from '@/components/floating-bars/SortFilterMenu';
import type { AssetFilter } from '@/features/asset-list/assetQuery';

// The asset grids' filter choices, for the sort / filter menus.
const assetFilterOptions: FilterOption<AssetFilter>[] = [
  { key: 'all', label: 'All Media', icon: 'apps' },
  { key: 'favorites', label: 'Favorites', icon: 'heart' },
  { key: 'images', label: 'Photos', icon: 'image' },
  { key: 'videos', label: 'Videos', icon: 'video' },
];

export default assetFilterOptions;
