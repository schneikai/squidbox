import { useLocalSearchParams } from 'expo-router';

import NotesEditSheet from '@/components/NotesEditSheet';
import useAlbum from '@/features/album-detail/useAlbum';
import useAlbums from '@/features/albums-context/useAlbums';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';

// An album's notes as a draft sheet, saved on Save (an asset's are edited in its details, AssetNote).
export default function AlbumNotesScreen() {
  const { albumId } = useLocalSearchParams();
  const album = useAlbum(albumId);
  const { updateAlbum } = useAlbums();
  useCloseWhenGone(album, 'This album was deleted');

  if (!album) return null;

  return <NotesEditSheet notes={album.notes} onSave={(notes) => updateAlbum(album.id, { notes })} />;
}
