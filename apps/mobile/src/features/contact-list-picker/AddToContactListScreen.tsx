import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import ContactListPicker from './ContactListPicker';

import EditSheetHeader from '@/components/EditSheetHeader';
import ModalSheet from '@/components/ModalSheet';
import useEditSheet from '@/hooks/useEditSheet';
import listParam from '@/lib/listParam';
import useContacts from '@/providers/contacts/useContacts';

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
    <ModalSheet>
      <EditSheetHeader {...sheetProps} title="Add to lists" />
      <ContactListPicker selectedIds={listIds} onChange={setListIds} />
    </ModalSheet>
  );
}
