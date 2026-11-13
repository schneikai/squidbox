import { Alert } from 'react-native';

import useAlbums from '@/providers/albums/useAlbums';

// Asks for a name and adds an empty album with it.
export default function useAddAlbumAction(): () => void {
  const { addAlbum } = useAlbums();

  return function promptAddAlbum() {
    Alert.prompt('Album name', undefined, (name) => {
      if (name) addAlbum({ name });
    });
  };
}
