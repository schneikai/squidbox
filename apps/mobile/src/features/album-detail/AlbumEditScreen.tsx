import { useLocalSearchParams } from 'expo-router';

import NameNotesEditSheet from '@/components/NameNotesEditSheet';
import useAlbum from '@/features/album-detail/useAlbum';
import useAlbums from '@/features/albums-context/useAlbums';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';

// Edit album, from the album's ⋯ menu, its name or its note: its name and note as a draft sheet.
export default function AlbumEditScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const album = useAlbum(albumId);
  const { updateAlbum } = useAlbums();
  useCloseWhenGone(album, 'This album was deleted');

  if (!album) return null;

  return (
    <NameNotesEditSheet
      name={album.name}
      notes={album.notes}
      title="Edit album"
      namePlaceholder="Album name"
      notesLabel="Note"
      notesPlaceholder="Add a note…"
      testID="album-edit-sheet"
      onSave={(changes) => updateAlbum(album.id, changes)}
    />
  );
}
