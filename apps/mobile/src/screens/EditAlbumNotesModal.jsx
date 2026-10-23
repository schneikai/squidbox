import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import useAlbums from '@/features/albums-context/useAlbums';
import noteText from '@/utils/noteText';

// An album's notes (an asset's are edited in its details, AssetNote).
export default function EditAlbumNotesModal({ route, navigation }) {
  const { id, notes: initialNotes } = route.params;
  const { bottom } = useSafeAreaInsets();
  const [notes, setNotes] = useState(initialNotes ?? '');

  const { updateAlbum } = useAlbums();

  // Saved only when changed, so a notes edit another device made meanwhile isn't sent back.
  async function saveNotes(value) {
    if (value !== noteText(initialNotes)) await updateAlbum(id, { notes: value });
    navigation.goBack();
  }

  async function handleSave() {
    await saveNotes(noteText(notes));
  }

  async function handleDelete() {
    await saveNotes(null);
  }

  return (
    <ModalSheet style={{ paddingBottom: bottom || SCREEN_PADDING }}>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Notes"
        rightSlot={
          <>
            <IconButton icon="trash" onPress={handleDelete} variant="danger" accessibilityLabel="Delete note" />
            <PrimaryButton size="compact" label="Save" onPress={handleSave} />
          </>
        }
      />
      <Card style={[styles.inputCard, { marginTop: MODAL_HEADER_HEIGHT + 8 }]}>
        <Textarea value={notes} onChangeText={setNotes} placeholder="Add a note…" autoFocus style={styles.input} />
      </Card>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    flex: 1,
    margin: SCREEN_PADDING,
  },
  input: {
    flex: 1,
    padding: SCREEN_PADDING,
  },
});
