import { useNavigation } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import ContactListPicker from './ContactListPicker';

import Button from '@/components/Button';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { Row } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import pinnedList from '@/features/contact-list/pinnedList';
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
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ContactListPicker
          isSingle
          selectedIds={pinned ? [pinned.id] : []}
          onChange={([listId]) => handlePin(listId ?? null)}
          leadingRows={<Row label="Favorites" isSelected={!pinned} onPress={() => handlePin(null)} />}
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
