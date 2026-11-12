import { useNavigation } from 'expo-router';

import useNewContactDraft from './useNewContactDraft';

import EditSheetHeader from '@/components/EditSheetHeader';
import ModalSheet from '@/components/ModalSheet';
import ContactListPicker from '@/features/contact-list-picker/ContactListPicker';

// The New contact sheet's Lists step: the lists to put the new contact in, kept in the draft.
export default function NewContactListsScreen() {
  const navigation = useNavigation();
  const { listIds, setListIds } = useNewContactDraft();

  return (
    <ModalSheet>
      <EditSheetHeader
        title="Lists"
        confirmLabel="Done"
        canConfirm
        onCancel={() => navigation.goBack()}
        onConfirm={() => navigation.goBack()}
      />
      <ContactListPicker selectedIds={listIds} onChange={setListIds} />
    </ModalSheet>
  );
}
