import { Text } from 'react-native';

import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import listTextStyles from '@/styles/listTextStyles';
import { SMART_ALBUM_TYPES } from '@/utils/albums/constants';

// A caption; `style` adds layout.
export default function AlbumLastPostedAt({ album, style, numberOfLines }) {
  if (album.smartAlbumType === SMART_ALBUM_TYPES.DELETED) return null;

  return (
    <Text style={[listTextStyles.caption, style]} numberOfLines={numberOfLines}>
      {albumLastPostedText(album)}
    </Text>
  );
}
