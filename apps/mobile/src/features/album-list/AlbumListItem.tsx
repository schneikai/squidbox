import { StyleSheet, View, Text as RNText } from 'react-native';

import Badge from '@/components/Badge';
import CoverImage from '@/components/CoverImage';
import FavoriteAlbumIndicator from '@/components/FavoriteAlbumIndicator';
import Text from '@/components/Text';
import AlbumLastPostedAt from '@/features/album-list/AlbumLastPostedAt';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import cornerStyles from '@/styles/cornerStyles';
import { layout, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

type AlbumListItemProps = { album: AlbumListRow; elementWidth: number; showLastPostedAt: boolean };

// `album` is an albumQuery row: it carries its cover and stats.
export default function AlbumListItem({ album, elementWidth, showLastPostedAt }: AlbumListItemProps) {
  return (
    <View testID="album-tile" style={{ width: elementWidth }}>
      <CoverImage asset={album.cover} style={{ height: elementWidth }}>
        <View style={[cornerStyles.topLeft, styles.indicators]}>
          <FavoriteAlbumIndicator isFavorite={album.isFavorite} />
        </View>
      </CoverImage>

      {Boolean(album.archivedAt) && <Badge label="Archived" tone="danger" style={styles.archived} />}
      <Text variant="label" tone="primary" numberOfLines={1} style={styles.albumTitle}>
        {album.name}
      </Text>
      <View style={styles.metaRow}>
        <RNText style={[listTextStyles.caption, styles.metaCount]} numberOfLines={1}>
          {pluralizeText('1 Asset', '%{count} Assets', album.assetCount)}
        </RNText>
        {showLastPostedAt && <AlbumLastPostedAt album={album} style={styles.metaPosted} numberOfLines={1} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  albumTitle: {
    marginTop: space.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.sm,
  },
  metaCount: {
    flexShrink: 0,
  },
  metaPosted: {
    flexShrink: 1,
    textAlign: 'right',
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
