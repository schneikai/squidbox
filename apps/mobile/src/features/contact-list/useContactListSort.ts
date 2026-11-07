import contactSortOptions, { type ContactSort } from './contactSortOptions';

import useAppSettings from '@/features/app-settings/useAppSettings';

const DEFAULT_SORT: ContactSort = 'name:asc';

const isContactSort = (key: string): key is ContactSort => contactSortOptions.some((option) => option.key === key);

// The contact lists' sort, from the contacts' sort choices (Name, Recently added), remembered across
// launches (listsSortOrder) and shared by the Lists tab and the list picker; a stored key no longer
// offered falls back to Name.
export default function useContactListSort(): { sortOrder: ContactSort; sortLists: (key: ContactSort) => void } {
  const { listsSortOrder, setListsSortOrder } = useAppSettings();
  const sortOrder = isContactSort(listsSortOrder) ? listsSortOrder : DEFAULT_SORT;

  return { sortOrder, sortLists: setListsSortOrder };
}
