import type { SortOption } from '@/components/floating-bars/SortFilterMenu';
import type { PostSort } from '@/features/post-list/postQuery';

// The post list's sort choices (postQuery sorts by posted date), for the sort / filter menus.
const postSortOptions: SortOption<PostSort>[] = [
  { key: 'postedAt:desc', label: 'Newest first' },
  { key: 'postedAt:asc', label: 'Oldest first' },
];

export default postSortOptions;
