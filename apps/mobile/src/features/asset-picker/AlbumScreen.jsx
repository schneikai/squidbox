import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import useAlbum from '@/features/album-detail/useAlbum';
import PickerAssetGrid from '@/features/asset-picker/PickerAssetGrid';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';

export default function AlbumScreen({ route, navigation }) {
  const { setAlbumScreenProps } = useAssetPicker();
  const { albumId } = route.params;
  const album = useAlbum(albumId);

  useFocusEffect(
    useCallback(() => {
      setAlbumScreenProps({ album, navigation });
      return () => {
        setAlbumScreenProps(null);
      };
    }, [navigation, album]),
  );

  if (!album) return null;

  return <PickerAssetGrid album={album} label={album.name} />;
}
