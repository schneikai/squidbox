import contactSortOptions, { type ContactSort } from './contactSortOptions';

import useAppSettings from '@/features/app-settings/useAppSettings';

const DEFAULT_SORT: ContactSort = 'name:asc';

const isContactSort = (key: string): key is ContactSort => contactSortOptions.some((option) => option.key === key);

/**
 * A sort from the contacts' choices (Name, Recently added), remembered across launches: of the
 * `contacts` (contactListSortOrder; the Contacts tab and a list's screen) or of the `lists`
 * (listsSortOrder; the Lists tab and the list picker). A stored key no longer offered falls back to
 * Name.
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
