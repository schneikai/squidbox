import type { SortOption } from '@/components/floating-bars/SortFilterMenu';
import type { AssetSort } from '@/sync/assetSql';

// An asset grid's sort choices, by the date an asset was added to Squidbox. Albums add Custom order.
const assetSortOptions: SortOption<AssetSort>[] = [
  { key: 'createdAt:desc', label: 'Newest first' },
  { key: 'createdAt:asc', label: 'Oldest first' },
];

export default assetSortOptions;
