import { useNavigation } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import ContactListPicker from './ContactListPicker';

import Button from '@/components/Button';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import pinnedList from '@/features/contact-list/pinnedList';
import useBuiltInContactListRows from '@/features/contact-list/useBuiltInContactListRows';
import useContactListRows from '@/features/contact-list/useContactListRows';
import useContacts from '@/features/contacts-context/useContacts';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';

// The pen on the Contacts tab's pinned row: Favorites or one of the lists to show there, the shown one
// checked. A tap pins it and closes the sheet, as Add to Album does.
export default function PinContactListScreen() {
  const navigation = useNavigation();
  const { paddingBottom } = useScreenPadding('sheet');
  const { pinList } = useContacts();
  const pinned = pinnedList(useContactListRows({ withMembers: false }));
  // Favorites is what shows unless a list is pinned.
  const favorites = useBuiltInContactListRows()?.filter((list) => list.id === 'favorites');

  function handlePin(listId: string | null) {
    pinList(listId === 'favorites' ? null : listId);
    navigation.goBack();
  }

  return (
    <ModalSheet>
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Pin to Contacts"
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ContactListPicker
          isSingle
          selectedIds={[pinned?.id ?? 'favorites']}
          onChange={([listId]) => handlePin(listId ?? null)}
          builtIns={favorites}
        />
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: layout.sheetContentTop,
    paddingHorizontal: SCREEN_PADDING,
  },
});
