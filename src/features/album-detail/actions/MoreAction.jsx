import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';

import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useAlbums from '@/features/albums-context/useAlbums';
import getTimestamp from '@/utils/date-time/getTimestamp';

export default function MoreAction({ album, afterDelete, onSelect }) {
  const { updateAlbum, setAlbumDeleted } = useAlbums();
  const navigation = useNavigation();

  async function handleDeleteAlbum() {
    Alert.alert('Delete Album?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await setAlbumDeleted(album);
          if (afterDelete) afterDelete();
        },
      },
    ]);
  }

  async function handleRenameAlbum() {
    Alert.prompt('Album name', '', async (name) => {
      await updateAlbum(album.id, { name });
    }, 'plain-text', album.name);
  }

  function handleEditNotes() {
    navigation.navigate('EditNotesModal', { type: 'album', id: album.id, notes: album.notes ?? '' });
  }

  async function handleArchiveAlbum() {
    await updateAlbum(album.id, { archivedAt: getTimestamp() });
  }

  async function handleUnarchiveAlbum() {
    await updateAlbum(album.id, { archivedAt: null });
  }

  return (
    <PopupMenu icon="ellipsis-horizontal" variant="pill">
      {!!onSelect && <MenuOption label="Select" icon="checkmark-circle-outline" onPress={onSelect} />}
      <MenuOption
        label={album.notes ? 'Edit note' : 'Add note'}
        icon="document-text-outline"
        onPress={handleEditNotes}
      />
      <MenuOption label="Rename" icon="pencil-outline" onPress={handleRenameAlbum} />
      {!!album.archivedAt && (
        <MenuOption label="Unarchive" icon="arrow-up-circle-outline" onPress={handleUnarchiveAlbum} />
      )}
      {!album.archivedAt && (
        <MenuOption label="Archive" icon="archive-outline" onPress={handleArchiveAlbum} />
      )}
      <MenuOption label="Delete" icon="trash-outline" onPress={handleDeleteAlbum} danger isLast />
    </PopupMenu>
  );
}
