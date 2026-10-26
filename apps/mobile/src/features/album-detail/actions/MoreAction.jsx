import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';

import IconMenuButton from '@/components/IconMenuButton';
import MenuDivider from '@/components/popup-menu-options/MenuDivider';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAlbums from '@/features/albums-context/useAlbums';
import confirmAsync from '@/utils/confirmAsync';
import getTimestamp from '@/utils/date-time/getTimestamp';

export default function MoreAction({ album, afterDelete, onSelect }) {
  const { updateAlbum, setAlbumDeleted } = useAlbums();
  const navigation = useNavigation();

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
    navigation.navigate('AlbumNotesScreen', { id: album.id, notes: album.notes ?? '' });
  }

  async function handleArchiveAlbum() {
    await updateAlbum(album.id, { archivedAt: getTimestamp() });
  }

  async function handleUnarchiveAlbum() {
    await updateAlbum(album.id, { archivedAt: null });
  }

  return (
    <IconMenuButton>
      {!!onSelect && <MenuOption label="Select" icon="check-circle" onPress={onSelect} />}
      <MenuOption label={album.notes ? 'Edit note' : 'Add note'} icon="document" onPress={handleEditNotes} />
      <MenuOption label="Rename" icon="pencil" onPress={handleRenameAlbum} />
      {!!album.archivedAt && <MenuOption label="Unarchive" icon="arrow-up-circle" onPress={handleUnarchiveAlbum} />}
      {!album.archivedAt && <MenuOption label="Archive" icon="archive" onPress={handleArchiveAlbum} />}
      <MenuDivider />
      <MenuOption label="Delete" icon="trash" onPress={handleDeleteAlbum} danger />
    </IconMenuButton>
  );
}
