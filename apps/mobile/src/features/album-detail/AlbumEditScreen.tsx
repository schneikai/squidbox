import { useLocalSearchParams } from 'expo-router';

import NameNotesEditSheet from '@/components/NameNotesEditSheet';
import useAlbum from '@/features/album-detail/useAlbum';
import useAlbums from '@/features/albums-context/useAlbums';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';

// Edit album, from the album's ⋯ menu, its name or its note: its name, note and star as a draft sheet,
// with the cursor in the note when its note opened it (`focus=notes`).
export default function AlbumEditScreen() {
  const { albumId, focus } = useLocalSearchParams<{ albumId: string; focus?: 'notes' }>();
  const album = useAlbum(albumId);
  const { updateAlbum } = useAlbums();
  useCloseWhenGone(album, 'This album was deleted');

  if (!album) return null;

  return (
    <NameNotesEditSheet
      name={album.name}
      notes={album.notes}
      starred={album.isFavorite}
      title="Edit album"
      namePlaceholder="Album name"
      notesLabel="Note"
      notesPlaceholder="Add a note…"
      focus={focus}
      testID="album-edit-sheet"
      onSave={({ starred, ...changes }) =>
        updateAlbum(album.id, starred === undefined ? changes : { ...changes, isFavorite: starred })
      }
    />
  );
}
