import { StyleSheet, View, Text } from 'react-native';
import { colors, scale } from '@/styles/designTokens';

import AssetImage from '@/components/AssetImage';
import FavoriteAlbumIndicator from '@/components/FavoriteAlbumIndicator';
import AlbumLastPostedAt from '@/features/album-list/AlbumLastPostedAt';
import pluralizeText from '@/utils/pluralizeText';

export default function AlbumListItem({ album, thumbnailAsset, numberOfAssets, elementWidth }) {
  return (
    <View style={[styles.album, { width: elementWidth }]}>
      <View style={[styles.imageContainer, { height: elementWidth }]}>
        <AssetImage asset={thumbnailAsset} />
        <View style={styles.indicators}>
          <FavoriteAlbumIndicator isFavorite={album.isFavorite} />
        </View>
      </View>

      {album.archivedAt && (
        <View style={{ alignSelf: 'left' }}>
          <Text style={styles.isArchived}>Archived</Text>
        </View>
      )}
      <Text style={styles.albumTitle} numberOfLines={1} ellipsizeMode="tail">
        {album.name}
      </Text>
      <View style={styles.metaRow}>
        <Text style={[styles.albumInfo, styles.metaCount]} numberOfLines={1}>
          {pluralizeText('1 Asset', '%{count} Assets', numberOfAssets)}
        </Text>
        <AlbumLastPostedAt album={album} style={[styles.albumInfo, styles.metaPosted]} numberOfLines={1} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  album: {},
  imageContainer: {
    backgroundColor: 'lightgrey',
  },
  albumTitle: {
    marginTop: 4,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 6,
  },
  albumInfo: {
    color: colors.textSecondary,
    fontSize: scale(12),
    fontWeight: '500',
  },
  metaCount: {
    flexShrink: 0,
  },
  metaPosted: {
    flexShrink: 1,
    textAlign: 'right',
  },
  indicators: {
    position: 'absolute',
    top: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  isArchived: {
    marginTop: 4,
    marginBottom: -2,
    backgroundColor: 'pink',
    paddingHorizontal: 3,
    paddingVertical: 2,
    fontSize: scale(9),
    textTransform: 'uppercase',
    fontWeight: '800',
    zIndex: 1,
  },
});
