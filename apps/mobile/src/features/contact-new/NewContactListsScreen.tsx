import { useNavigation } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import useNewContactDraft from './useNewContactDraft';

import EditSheetHeader from '@/components/EditSheetHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import ContactListPicker from '@/features/contact-list-picker/ContactListPicker';
import { layout } from '@/styles/designTokens';

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
      <ScrollView contentContainerStyle={styles.content}>
        <ContactListPicker selectedIds={listIds} onChange={setListIds} />
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
