import { StyleSheet, View, Text } from 'react-native';

import Badge from '@/components/Badge';
import CoverImage from '@/components/CoverImage';
import FavoriteAlbumIndicator from '@/components/FavoriteAlbumIndicator';
import AlbumLastPostedAt from '@/features/album-list/AlbumLastPostedAt';
import cornerStyles from '@/styles/cornerStyles';
import { layout, space, textStyles } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

// `album` is an albumQuery row: it carries its cover and stats.
export default function AlbumListItem({ album, elementWidth, showLastPostedAt }) {
  return (
    <View style={{ width: elementWidth }}>
      <CoverImage asset={album.cover} style={{ height: elementWidth }}>
        <View style={[cornerStyles.topLeft, styles.indicators]}>
          <FavoriteAlbumIndicator isFavorite={album.isFavorite} />
        </View>
      </CoverImage>

      {Boolean(album.archivedAt) && <Badge label="Archived" tone="danger" style={styles.archived} />}
      <Text style={[textStyles.footnoteBold, styles.albumTitle]} numberOfLines={1} ellipsizeMode="tail">
        {album.name}
      </Text>
      <View style={styles.metaRow}>
        <Text style={[listTextStyles.caption, styles.metaCount]} numberOfLines={1}>
          {pluralizeText('1 Asset', '%{count} Assets', album.assetCount)}
        </Text>
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
    gap: layout.iconGap,
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
