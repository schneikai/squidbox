import contactSortOptions from './contactSortOptions';

import useAppSettings from '@/features/app-settings/useAppSettings';

const DEFAULT_SORT = 'name:asc';

// The contacts' sort, remembered across launches (contactListSortOrder) and shared by the Contacts
// tab and a list's screen; a stored key no longer offered falls back to Name.
export default function useContactSort() {
  const { contactListSortOrder, setContactListSortOrder } = useAppSettings();
  const sortOrder = contactSortOptions.some(({ key }) => key === contactListSortOrder)
    ? contactListSortOrder
    : DEFAULT_SORT;

  return { sortOrder, sortContacts: setContactListSortOrder };
}
