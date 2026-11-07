import useAppSettings from '@/features/app-settings/useAppSettings';
import contactSortOptions, { type ContactSort } from '@/features/contact-list/contactSortOptions';

const DEFAULT_SORT: ContactSort = 'name:asc';

const isContactSort = (key: string): key is ContactSort => contactSortOptions.some((option) => option.key === key);

// The list picker's sort, from the contacts' sort choices (Name, Recently added), remembered across
// launches (contactListPickerSortOrder); a stored key no longer offered falls back to Name.
export default function useContactListSort(): { sortOrder: ContactSort; sortLists: (key: ContactSort) => void } {
  const { contactListPickerSortOrder, setContactListPickerSortOrder } = useAppSettings();
  const sortOrder = isContactSort(contactListPickerSortOrder) ? contactListPickerSortOrder : DEFAULT_SORT;

  return { sortOrder, sortLists: setContactListPickerSortOrder };
}
