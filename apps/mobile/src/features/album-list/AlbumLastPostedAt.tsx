import { type StyleProp, Text, type TextProps, type TextStyle } from 'react-native';

import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import listTextStyles from '@/styles/listTextStyles';
import isDeletedAssetsAlbum from '@/utils/albums/isDeletedAssetsAlbum';

type AlbumLastPostedAtProps = {
  album: AlbumListRow;
  style?: StyleProp<TextStyle>;
  numberOfLines?: TextProps['numberOfLines'];
};

// A caption; `style` adds layout.
export default function AlbumLastPostedAt({ album, style, numberOfLines }: AlbumLastPostedAtProps) {
  if (isDeletedAssetsAlbum(album)) return null;

  return (
    <Text style={[listTextStyles.caption, style]} numberOfLines={numberOfLines}>
      {albumLastPostedText(album)}
    </Text>
  );
}
