// The contacts' sort choices (contactQuery's `sort`), for the sort menu of the Contacts tab and a list.
import type { SortOption } from '@/components/floating-bars/SortFilterMenu';

export type ContactSort = 'name:asc' | 'createdAt:desc';

const contactSortOptions: SortOption<ContactSort>[] = [
  { key: 'name:asc', label: 'Name' },
  { key: 'createdAt:desc', label: 'Recently added' },
];

export default contactSortOptions;
