import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Alert } from 'react-native';

import useAlbums from '@/features/albums-context/useAlbums';
import actionButtonStyles from '@/styles/actionButtonStyles';

export default function AddAlbumAction() {
  const { addAlbum } = useAlbums();

  function handleAddAlbum() {
    Alert.prompt('Album name', undefined, (name) => {
      addAlbum({ name });
    });
  }

  return (
    <Pressable onPress={handleAddAlbum} style={[actionButtonStyles.button, { marginRight: 20 }]}>
      <Ionicons name="add" style={actionButtonStyles.buttonIcon} />
    </Pressable>
  );
}
