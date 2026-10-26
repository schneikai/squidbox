import { useState } from 'react';
import { Alert } from 'react-native';

import TextEditScreen from '@/components/TextEditScreen';
import useAlbums from '@/features/albums-context/useAlbums';
import useHaptics from '@/hooks/useHaptics';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import noteText from '@/utils/noteText';

// An album's notes, saved as you type (an asset's are edited in its details, AssetNote).
export default function AlbumNotesScreen({ route, navigation }) {
  const { id, notes: initialNotes } = route.params;
  const { updateAlbum } = useAlbums();
  const haptics = useHaptics();
  const [notes, setNotes] = useState(initialNotes ?? '');
  // Saved only when changed, so a notes edit another device made meanwhile isn't sent back.
  const { flush, end } = useSaveAsYouType(noteText(notes), saveNotes);

  async function saveNotes(next) {
    await updateAlbum(id, { notes: next }, { shouldSync: false });
  }

  // After the saves under way, and nothing typed is saved after it.
  async function handleDelete() {
    try {
      await end(() => updateAlbum(id, { notes: null }));
      navigation.goBack();
    } catch (error) {
      console.error('Deleting the note failed', error);
      haptics.error();
      Alert.alert("Couldn't delete the note", error.message);
    }
  }

  return (
    <TextEditScreen
      title="Notes"
      value={notes}
      onChangeText={setNotes}
      onBlur={() => flush()}
      onBack={() => navigation.goBack()}
      placeholder="Add a note…"
      autoFocus
      action={noteText(notes) ? { label: 'Delete note', tone: 'danger', onPress: handleDelete } : null}
    />
  );
}
