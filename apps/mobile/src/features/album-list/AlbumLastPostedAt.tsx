import { Text } from 'react-native';

import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import listTextStyles from '@/styles/listTextStyles';
import isDeletedAssetsAlbum from '@/utils/albums/isDeletedAssetsAlbum';

type AlbumLastPostedAtProps = { album: AlbumListRow };

// A caption on one line, under an album tile's name.
export default function AlbumLastPostedAt({ album }: AlbumLastPostedAtProps) {
  if (isDeletedAssetsAlbum(album)) return null;

  return (
    <Text style={listTextStyles.caption} numberOfLines={1}>
      {albumLastPostedText(album)}
    </Text>
  );
}
