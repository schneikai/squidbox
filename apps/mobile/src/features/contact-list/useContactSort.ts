import contactSortOptions from './contactSortOptions';

import useAppSettings from '@/providers/app-settings/useAppSettings';
import type { ContactSort } from '@/sync/queries/contactQuery';

const DEFAULT_SORT: ContactSort = 'name:asc';

const isContactSort = (key: string): key is ContactSort => contactSortOptions.some((option) => option.key === key);

/**
 * A sort from the contacts' choices (Name, Recently added), remembered across launches: of the
 * `contacts` (contactListSortOrder; the Contacts tab and a list's screen) or of the `lists`
 * (listsSortOrder; the Lists screen). A stored key no longer offered falls back to Name.
 */
export default function useContactSort(of: 'contacts' | 'lists' = 'contacts'): {
  sortOrder: ContactSort;
  setSortOrder: (key: ContactSort) => void;
} {
  const { contactListSortOrder, setContactListSortOrder, listsSortOrder, setListsSortOrder } = useAppSettings();
  const [stored, setSortOrder] =
    of === 'lists' ? [listsSortOrder, setListsSortOrder] : [contactListSortOrder, setContactListSortOrder];

  return { sortOrder: isContactSort(stored) ? stored : DEFAULT_SORT, setSortOrder };
}
