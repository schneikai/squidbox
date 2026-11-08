import { StyleSheet, View } from 'react-native';

import Badge from '@/components/Badge';
import CoverImage from '@/components/CoverImage';
import FavoriteAlbumIndicator from '@/components/FavoriteAlbumIndicator';
import Text from '@/components/Text';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import AlbumLastPostedAt from '@/features/album-list/AlbumLastPostedAt';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import cornerStyles from '@/styles/cornerStyles';
import { layout, space } from '@/styles/designTokens';

type AlbumListItemProps = { album: AlbumListRow; elementWidth: number };

// `album` is an albumQuery row: it carries its cover and stats.
export default function AlbumListItem({ album, elementWidth }: AlbumListItemProps) {
  return (
    <View testID="album-tile" style={{ width: elementWidth }}>
      <CoverImage asset={album.cover} style={{ height: elementWidth }}>
        <View style={[cornerStyles.topLeft, styles.indicators]}>
          <FavoriteAlbumIndicator isFavorite={album.isFavorite} />
        </View>
        <ThumbnailBadge label={album.assetCount.toLocaleString()} corner="bottomRight" />
      </CoverImage>

      {Boolean(album.archivedAt) && <Badge label="Archived" tone="danger" style={styles.archived} />}
      <Text variant="label" tone="primary" numberOfLines={1} style={styles.albumTitle}>
        {album.name}
      </Text>
      <AlbumLastPostedAt album={album} />
    </View>
  );
}

const styles = StyleSheet.create({
  albumTitle: {
    marginTop: space.xs,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGapSmall,
  },
  archived: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
  },
});
