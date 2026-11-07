import type { FilterOption } from '@/components/floating-bars/SortFilterMenu';
import type { AlbumFilter } from '@/features/album-list/prepareAlbums';

// The albums list's filter choices, for the sort / filter menus.
const albumFilterOptions: FilterOption<AlbumFilter>[] = [
  { key: 'all', label: 'All Albums', icon: 'apps' },
  { key: 'starred', label: 'Starred', icon: 'star' },
  { key: 'archived', label: 'Archived', icon: 'archive' },
];

export default albumFilterOptions;
