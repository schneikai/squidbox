import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import PickerAssetGrid from '@/features/asset-picker/PickerAssetGrid';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';

export default function AlbumScreen({ route, navigation }) {
  const { setAlbumScreenProps } = useAssetPicker();
  const { albumId } = route.params;
  const [album] = useLiveQuery((db) => readByIds(db, schema.albums, [albumId]), [schema.albums], [albumId]) ?? [];

  useFocusEffect(
    useCallback(() => {
      setAlbumScreenProps({ album, navigation });
      return () => {
        setAlbumScreenProps(null);
      };
    }, [navigation, album]),
  );

  if (!album || album.deletedAt) return null;

  return <PickerAssetGrid album={album} label={album.name} />;
}
