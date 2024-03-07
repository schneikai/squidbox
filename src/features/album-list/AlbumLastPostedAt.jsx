import { Text } from 'react-native';

import { SMART_ALBUM_TYPES } from '@/utils/albums/constants';
import dateToTimeAgo from '@/utils/date-time/dateToTimeAgo';

export default function AlbumLastPostedAt({ album, style }) {
  if (album.smartAlbumType === SMART_ALBUM_TYPES.DELETED) return null;

  if (!album.lastPostedAt) {
    return <Text style={style}>Never posted</Text>;
  }

  return <Text style={style}>Posted {dateToTimeAgo(album.lastPostedAt)}</Text>;
}
