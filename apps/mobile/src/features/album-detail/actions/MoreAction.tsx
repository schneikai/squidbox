import { router } from 'expo-router';
import { Alert } from 'react-native';

import Divider from '@/components/Divider';
import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAlbums from '@/features/albums-context/useAlbums';
import type { AlbumRow } from '@/sync/db/schema';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import confirmAsync from '@/utils/confirmAsync';
import getTimestamp from '@/utils/date-time/getTimestamp';

type MoreActionProps = { album: AlbumRow; hasPhotos?: boolean; afterDelete?: () => void; onSelect?: () => void };

export default function MoreAction({ album, hasPhotos = false, afterDelete, onSelect }: MoreActionProps) {
  const { updateAlbum, setAlbumDeleted } = useAlbums();

  async function handleDeleteAlbum() {
    if (!(await confirmAsync({ title: 'Delete Album?', action: 'Delete', destructive: true }))) return;
    await setAlbumDeleted(album);
    if (afterDelete) afterDelete();
  }

  async function handleRenameAlbum() {
    Alert.prompt(
      'Album name',
      '',
      async (name) => {
        if (name !== album.name) await updateAlbum(album.id, { name });
      },
      'plain-text',
      album.name,
    );
  }

  function handleEditNotes() {
    router.navigate(`/album/${album.id}/notes`);
  }

  function handleAddContactsToPhotos() {
    router.navigate({ pathname: '/add-contacts', params: { albumId: album.id } });
  }

  async function handleArchiveAlbum() {
    await updateAlbum(album.id, { archivedAt: getTimestamp() });
  }

  async function handleUnarchiveAlbum() {
    await updateAlbum(album.id, { archivedAt: null });
  }

  return (
    <MenuButton>
      {!!onSelect && <MenuOption label="Select" icon="check-circle" onPress={onSelect} />}
      <MenuOption label={album.notes ? 'Edit note' : 'Add note'} icon="document" onPress={handleEditNotes} />
      <MenuOption label="Rename" icon="edit" onPress={handleRenameAlbum} />
      {hasPhotos && !isSmartAlbum(album) && (
        <MenuOption label="Add contacts to photos" icon="contacts" onPress={handleAddContactsToPhotos} />
      )}
      {!!album.archivedAt && <MenuOption label="Unarchive" icon="arrow-up-circle" onPress={handleUnarchiveAlbum} />}
      {!album.archivedAt && <MenuOption label="Archive" icon="archive" onPress={handleArchiveAlbum} />}
      <Divider variant="menu" />
      <MenuOption label="Delete" icon="trash" onPress={handleDeleteAlbum} colorPalette="danger" />
    </MenuButton>
  );
}
