import { Alert } from 'react-native';

import useAlbums from '@/features/albums-context/useAlbums';

// Asks for a name and adds an empty album with it.
export default function useAddAlbumAction() {
  const { addAlbum } = useAlbums();

  return function promptAddAlbum() {
    Alert.prompt('Album name', undefined, (name) => {
      if (name) addAlbum({ name });
    });
  };
}
