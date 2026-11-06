import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import ContactListPicker from './ContactListPicker';

import EditSheet from '@/components/EditSheet';
import useContacts from '@/features/contacts-context/useContacts';
import useEditSheet from '@/hooks/useEditSheet';
import listParam from '@/lib/listParam';

// Adds one or more contacts (`?contactIds=`) to the lists picked, on Save.
export default function AddToContactListScreen() {
  const { contactIds } = useLocalSearchParams<{ contactIds?: string }>();
  const { addToLists } = useContacts();
  const [listIds, setListIds] = useState<string[]>([]);
  const { sheetProps } = useEditSheet({
    isDirty: listIds.length > 0,
    save: () => addToLists(listParam(contactIds), listIds),
    syncsItself: true,
  });

  return (
    <EditSheet {...sheetProps} title="Add to lists">
      <ContactListPicker selectedIds={listIds} onChange={setListIds} />
    </EditSheet>
  );
}
