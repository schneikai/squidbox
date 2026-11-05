import { useNavigation } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import useNewContactDraft from './useNewContactDraft';

import Button from '@/components/Button';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import ContactListPicker from '@/features/contact-list-picker/ContactListPicker';

// The New contact sheet's Lists step: the lists to put the new contact in, kept in the draft.
export default function NewContactListsScreen() {
  const navigation = useNavigation();
  const { listIds, setListIds } = useNewContactDraft();

  return (
    <ModalSheet>
      <ModalHeader
        leading={<Button icon="chevron-left" accessibilityLabel="Back" onPress={() => navigation.goBack()} />}
        title="Lists"
        trailing={<Button variant="primary" label="Done" onPress={() => navigation.goBack()} />}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ContactListPicker selectedIds={listIds} onChange={setListIds} />
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT,
    paddingHorizontal: SCREEN_PADDING,
  },
});
