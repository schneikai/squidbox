import { router } from 'expo-router';

import Divider from '@/components/Divider';
import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAlbums from '@/providers/albums/useAlbums';
import type { AlbumRow } from '@/sync/db/schema';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import confirmDeleteAsync from '@/utils/confirmDeleteAsync';
import getTimestamp from '@/utils/date-time/getTimestamp';

type MoreActionProps = { album: AlbumRow; hasPhotos?: boolean; afterDelete?: () => void; onSelect?: () => void };

export default function MoreAction({ album, hasPhotos = false, afterDelete, onSelect }: MoreActionProps) {
  const { updateAlbum, setAlbumDeleted } = useAlbums();
  // A smart album holds no photos of its own, so they are edited through a real album.
  const canEditPhotos = hasPhotos && !isSmartAlbum(album);

  async function handleDeleteAlbum() {
    if (!(await confirmDeleteAsync({ name: album.name }))) return;
    await setAlbumDeleted(album);
    if (afterDelete) afterDelete();
  }

  function handleEdit() {
    router.navigate(`/album/${album.id}/edit`);
  }

  function handleAddContactsToPhotos() {
    router.navigate({ pathname: '/add-contacts', params: { albumId: album.id } });
  }

  function handleTagPhotos() {
    router.navigate({ pathname: '/album-tags', params: { albumId: album.id } });
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
      {canEditPhotos && <MenuOption label="Add contacts" icon="contacts" onPress={handleAddContactsToPhotos} />}
      {canEditPhotos && <MenuOption label="Tags" icon="tag" onPress={handleTagPhotos} />}
      {!!album.archivedAt && <MenuOption label="Unarchive" icon="arrow-up-circle" onPress={handleUnarchiveAlbum} />}
      {!album.archivedAt && <MenuOption label="Archive" icon="archive" onPress={handleArchiveAlbum} />}
      <Divider variant="menu" />
      <MenuOption label="Delete" icon="trash" onPress={handleDeleteAlbum} colorPalette="danger" />
    </MenuButton>
  );
}
