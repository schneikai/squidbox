import { router } from 'expo-router';

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

  function handleEdit() {
    router.navigate(`/album/${album.id}/edit`);
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
      <MenuOption label="Edit" icon="edit" onPress={handleEdit} />
      {hasPhotos && !isSmartAlbum(album) && (
        <MenuOption label="Add contacts" icon="contacts" onPress={handleAddContactsToPhotos} />
      )}
      {!!album.archivedAt && <MenuOption label="Unarchive" icon="arrow-up-circle" onPress={handleUnarchiveAlbum} />}
      {!album.archivedAt && <MenuOption label="Archive" icon="archive" onPress={handleArchiveAlbum} />}
      <Divider variant="menu" />
      <MenuOption label="Delete" icon="trash" onPress={handleDeleteAlbum} colorPalette="danger" />
    </MenuButton>
  );
}
