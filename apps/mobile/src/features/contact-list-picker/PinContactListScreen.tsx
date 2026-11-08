import { useNavigation } from 'expo-router';
import { useMemo } from 'react';

import ContactListPicker from './ContactListPicker';

import Button from '@/components/Button';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import useBuiltInContactListRows from '@/features/contact-list/useBuiltInContactListRows';
import usePinnedContactList from '@/features/contact-list/usePinnedContactList';
import useContacts from '@/features/contacts-context/useContacts';

// The Contacts tab's pinned row's name, tapped: Favorites, Tagged (in an account's library) or one of the
// lists to show there, the shown one checked. A tap pins it and closes the sheet, as Add to Album does.
// Deleted isn't offered: the top of Contacts is for the people one works with.
const PINNABLE: string[] = ['favorites', 'tagged'];

export default function PinContactListScreen() {
  const navigation = useNavigation();
  const { pinList } = useContacts();
  const pin = usePinnedContactList();
  const builtInRows = useBuiltInContactListRows();
  const builtIns = useMemo(
    () => builtInRows?.filter((list) => PINNABLE.includes(list.id) && (list.id === 'favorites' || pin.canPinBuiltIn)),
    [builtInRows, pin.canPinBuiltIn],
  );

  function handlePin(listId: string | null) {
    pinList(listId);
    navigation.goBack();
  }

  return (
    <ModalSheet>
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Pin to Contacts"
      />
      <ContactListPicker
        isSingle
        selectedIds={[pin.pinned?.id ?? 'favorites']}
        onChange={([listId]) => handlePin(listId ?? null)}
        builtIns={builtIns}
      />
    </ModalSheet>
  );
}
