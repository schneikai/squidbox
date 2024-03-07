import { StyleSheet, View, Text } from 'react-native';

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
      <Text style={styles.albumTitle}>{album.name}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.albumInfo}>{pluralizeText('1 Asset', '%{count} Assets', numberOfAssets)}</Text>
        <AlbumLastPostedAt album={album} style={styles.albumInfo} />
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
  albumInfo: {
    color: 'grey',
    fontSize: 12,
    fontWeight: '500',
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
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '800',
    zIndex: 1,
  },
});
