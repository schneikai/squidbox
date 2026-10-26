import { useRef, useState } from 'react';

import TextEditScreen from '@/components/TextEditScreen';
import useAlbums from '@/features/albums-context/useAlbums';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import noteText from '@/utils/noteText';

// An album's notes, saved as you type (an asset's are edited in its details, AssetNote).
export default function AlbumNotesScreen({ route, navigation }) {
  const { id, notes: initialNotes } = route.params;
  const { updateAlbum } = useAlbums();
  const [notes, setNotes] = useState(initialNotes ?? '');
  // Set by Delete, after which nothing typed is saved.
  const isDeletedRef = useRef(false);
  // Saved only when changed, so a notes edit another device made meanwhile isn't sent back.
  const flush = useSaveAsYouType(noteText(notes), saveNotes);

  async function saveNotes(next) {
    if (!isDeletedRef.current) await updateAlbum(id, { notes: next });
  }

  async function handleDelete() {
    isDeletedRef.current = true;
    await updateAlbum(id, { notes: null });
    navigation.goBack();
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
