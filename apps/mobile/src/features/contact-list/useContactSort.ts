import contactSortOptions, { type ContactSort } from './contactSortOptions';

import useAppSettings from '@/features/app-settings/useAppSettings';

const DEFAULT_SORT: ContactSort = 'name:asc';

const isContactSort = (key: string): key is ContactSort => contactSortOptions.some((option) => option.key === key);

// The contacts' sort, remembered across launches (contactListSortOrder) and shared by the Contacts
// tab and a list's screen; a stored key no longer offered falls back to Name.
export default function useContactSort(): { sortOrder: ContactSort; sortContacts: (key: ContactSort) => void } {
  const { contactListSortOrder, setContactListSortOrder } = useAppSettings();
  const sortOrder = isContactSort(contactListSortOrder) ? contactListSortOrder : DEFAULT_SORT;

  return { sortOrder, sortContacts: setContactListSortOrder };
}
