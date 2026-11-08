import { Text } from 'react-native';

import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import listTextStyles from '@/styles/listTextStyles';
import isDeletedAssetsAlbum from '@/utils/albums/isDeletedAssetsAlbum';

type AlbumLastPostedAtProps = { album: AlbumListRow };

// A caption on one line, under an album tile's name. The Deleted album is never posted: its line
// stays, blank, so its tile is as tall as every other (the grid gives every cell one height).
export default function AlbumLastPostedAt({ album }: AlbumLastPostedAtProps) {
  return (
    <Text style={listTextStyles.caption} numberOfLines={1}>
      {isDeletedAssetsAlbum(album) ? '\u00A0' : albumLastPostedText(album)}
    </Text>
  );
}
