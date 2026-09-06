import { useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import useGetAlbumThumbnailAssetAndAssetCount from './useGetAlbumThumbnailAssetAndAssetCount';

import { SCREEN_PADDING } from '@/constants';
import useAlbums from '@/features/albums-context/useAlbums';

export default function AlbumList({
  albumIds,
  renderItem,
  ListHeaderComponent,
  listRef,
  contentContainerStyle,
  onScroll,
}) {
  const { albums } = useAlbums();
  const getAlbumThumbnailAssetAndAssetCount = useGetAlbumThumbnailAssetAndAssetCount();

  // I use window width and num of columns to calculate the width of each album
  // in the view. We also use columnWrapperStyle to get even margins left, right
  // and between the items without having the margins doubled where they touch.

  // Keep side insets and the gap between columns equal to SCREEN_PADDING so the
  // albums grid lines up with the posts list (which pads each item by SCREEN_PADDING).
  const window = useWindowDimensions();
  const numColumns = 2;
  const elementWidth = window.width / numColumns - SCREEN_PADDING * 1.5;

  return (
    <Animated.FlatList
      ref={listRef}
      data={albumIds}
      numColumns={numColumns}
      columnWrapperStyle={{
        marginHorizontal: SCREEN_PADDING,
        marginTop: SCREEN_PADDING,
        justifyContent: 'space-between',
      }}
      renderItem={({ item: albumId }) => {
        const album = albums[albumId];
        if (!album) return null;

        const { thumbnailAsset, numberOfAssets } = getAlbumThumbnailAssetAndAssetCount(album);

        return renderItem({ album, thumbnailAsset, numberOfAssets, elementWidth });
      }}
      keyExtractor={(albumId) => albumId}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? [0] : undefined}
      contentContainerStyle={contentContainerStyle}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}
