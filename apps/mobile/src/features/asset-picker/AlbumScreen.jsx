import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import useAlbums from '@/features/albums-context/useAlbums';
import PickerAssetGrid from '@/features/asset-picker/PickerAssetGrid';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';

export default function AlbumScreen({ route, navigation }) {
  const { albums } = useAlbums();
  const { setAlbumScreenProps } = useAssetPicker();
  const album = albums[route.params.albumId];

  useFocusEffect(
    useCallback(() => {
      setAlbumScreenProps({ album, navigation });
      return () => {
        setAlbumScreenProps(null);
      };
    }, [navigation]),
  );

  if (!album) return null;

  return <PickerAssetGrid album={album} label={album.name} />;
}
