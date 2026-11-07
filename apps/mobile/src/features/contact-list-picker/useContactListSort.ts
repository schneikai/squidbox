import contactListSortOptions, { type ContactListSort } from './contactListSortOptions';

import useAppSettings from '@/features/app-settings/useAppSettings';

const DEFAULT_SORT: ContactListSort = 'name:asc';

const isContactListSort = (key: string): key is ContactListSort =>
  contactListSortOptions.some((option) => option.key === key);

// The list picker's sort, remembered across launches (contactListPickerSortOrder); a stored key no
// longer offered falls back to Name.
export default function useContactListSort(): {
  sortOrder: ContactListSort;
  sortLists: (key: ContactListSort) => void;
} {
  const { contactListPickerSortOrder, setContactListPickerSortOrder } = useAppSettings();
  const sortOrder = isContactListSort(contactListPickerSortOrder) ? contactListPickerSortOrder : DEFAULT_SORT;

  return { sortOrder, sortLists: setContactListPickerSortOrder };
}
