import { useState } from 'react';

import TextEditSheet from '@/components/TextEditSheet';
import useAlbums from '@/features/albums-context/useAlbums';
import useEditSheet from '@/hooks/useEditSheet';
import noteText from '@/utils/noteText';

// An album's notes as a draft sheet, saved on Done (an asset's are edited in its details, AssetNote).
// An emptied note saves as none.
export default function AlbumNotesScreen({ route }) {
  const { id, notes: initialNotes } = route.params;
  const { updateAlbum } = useAlbums();
  const [notes, setNotes] = useState(initialNotes ?? '');
  const { sheetProps, finish } = useEditSheet({
    isDirty: noteText(notes) !== noteText(initialNotes),
    save,
    syncsItself: true,
  });

  // Sent only on Done, so a notes edit another device made meanwhile is kept unless you change them.
  async function save() {
    await updateAlbum(id, { notes: noteText(notes) });
  }

  function handleDelete() {
    finish(() => updateAlbum(id, { notes: null }), "Couldn't delete the note");
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title="Notes"
      value={notes}
      onChangeText={setNotes}
      placeholder="Add a note…"
      autoFocus
      actions={noteText(initialNotes) ? [{ label: 'Delete note', tone: 'danger', onPress: handleDelete }] : null}
    />
  );
}
