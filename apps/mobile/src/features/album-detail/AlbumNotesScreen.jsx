import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import TextEditSheet from '@/components/TextEditSheet';
import useAlbum from '@/features/album-detail/useAlbum';
import useAlbums from '@/features/albums-context/useAlbums';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useEditSheet from '@/hooks/useEditSheet';
import noteText from '@/utils/noteText';

// An album's notes as a draft sheet, saved on Save (an asset's are edited in its details, AssetNote).
// An emptied note saves as none.
export default function AlbumNotesScreen() {
  const { albumId } = useLocalSearchParams();
  const album = useAlbum(albumId);
  useCloseWhenGone(album, 'This album was deleted');
  if (!album) return null;
  return <AlbumNotesEditor album={album} />;
}

// The draft starts from the notes as they were when the sheet opened.
function AlbumNotesEditor({ album }) {
  const { updateAlbum } = useAlbums();
  const [initialNotes] = useState(album.notes);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const { sheetProps, finish } = useEditSheet({
    isDirty: noteText(notes) !== noteText(initialNotes),
    save,
    syncsItself: true,
  });

  // Sent only on Save, so a notes edit another device made meanwhile is kept unless you change them.
  async function save() {
    await updateAlbum(album.id, { notes: noteText(notes) });
  }

  function handleDelete() {
    finish(() => updateAlbum(album.id, { notes: null }), "Couldn't delete the note");
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title="Notes"
      value={notes}
      onChangeText={setNotes}
      placeholder="Add a note…"
      autoFocus
      actions={noteText(initialNotes) ? [{ label: 'Delete note', colorPalette: 'danger', onPress: handleDelete }] : []}
    />
  );
}
