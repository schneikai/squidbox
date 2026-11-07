// The contact lists' sort choices, for the list picker's sort menu (useContactListSort).
import type { SortOption } from '@/components/floating-bars/SortFilterMenu';

export type ContactListSort = 'name:asc' | 'memberCount:desc' | 'createdAt:desc';

const contactListSortOptions: SortOption<ContactListSort>[] = [
  { key: 'name:asc', label: 'Name' },
  { key: 'memberCount:desc', label: 'Most contacts' },
  { key: 'createdAt:desc', label: 'Recently added' },
];

export default contactListSortOptions;
