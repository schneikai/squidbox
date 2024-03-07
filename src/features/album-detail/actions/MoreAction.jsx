import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert } from 'react-native';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import TextMenuOption from '@/components/popup-menu-options/TextMenuOption';
import ToggleThumbnailStyleOption from '@/components/popup-menu-options/ToggleThumbnailStyleOption';
import useAlbums from '@/features/albums-context/useAlbums';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';
import getTimestamp from '@/utils/date-time/getTimestamp';

export default function MoreAction({ album, afterDelete }) {
  const { updateAlbum, setAlbumDeleted } = useAlbums();

  // TODO: Right now we only mark album as deleted. I would like to have a
  // undo on shake feature to restore the album.
  async function handleDeleteAlbum() {
    Alert.alert('Delete Album?', '', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
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
    });
  }

  async function handleArchiveAlbum() {
    await updateAlbum(album.id, { archivedAt: getTimestamp() });
  }

  async function handleUnarchiveAlbum() {
    await updateAlbum(album.id, { archivedAt: null });
  }

  return (
    <Menu>
      <MenuTrigger customStyles={{ triggerWrapper: headerActionStyles.button }}>
        <Ionicons name="ellipsis-vertical" style={headerActionStyles.buttonIcon} />
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>
        <ToggleThumbnailStyleOption />
        <TextMenuOption label="Rename" onPress={handleRenameAlbum} />
        {!!album.archivedAt && <TextMenuOption label="Unarchive" onPress={handleUnarchiveAlbum} />}
        {!album.archivedAt && <TextMenuOption label="Archive" onPress={handleArchiveAlbum} />}
        <TextMenuOption label="Delete" onPress={handleDeleteAlbum} isLast />
      </MenuOptions>
    </Menu>
  );
}
