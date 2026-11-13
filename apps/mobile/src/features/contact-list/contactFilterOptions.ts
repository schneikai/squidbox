import type { ContactFilter } from './contactQuery';

import type { FilterOption } from '@/components/floating-bars/SortFilterMenu';

// The Contacts tab's filter choices (contactQuery's `filter`), for its sort / filter menu.
const contactFilterOptions: FilterOption<ContactFilter>[] = [
  { key: 'all', label: 'All Contacts', icon: 'contacts' },
  { key: 'favorites', label: 'Favorites', icon: 'heart' },
  { key: 'tagged', label: 'Tagged', icon: 'image' },
];

export default contactFilterOptions;
