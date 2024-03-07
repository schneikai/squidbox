import { FlatList, useWindowDimensions } from 'react-native';

import useGetAlbumThumbnailAssetAndAssetCount from './useGetAlbumThumbnailAssetAndAssetCount';

import useAlbums from '@/features/albums-context/useAlbums';

export default function AlbumList({ albumIds, renderItem, ListHeaderComponent, listRef }) {
  const { albums } = useAlbums();
  const getAlbumThumbnailAssetAndAssetCount = useGetAlbumThumbnailAssetAndAssetCount();

  // I use window width and num of columns to calculate the width of each album
  // in the view. We also use columnWrapperStyle to get even margins left, right
  // and between the items without having the margins doubled where they touch.

  const window = useWindowDimensions();
  const numColumns = 2;
  const elementWidth = window.width / numColumns - 15;

  return (
    <FlatList
      ref={listRef}
      data={albumIds}
      numColumns={numColumns}
      columnWrapperStyle={{ marginHorizontal: 10, marginTop: 10, justifyContent: 'space-between' }}
      renderItem={({ item: albumId }) => {
        const album = albums[albumId];
        if (!album) return null;

        const { thumbnailAsset, numberOfAssets } = getAlbumThumbnailAssetAndAssetCount(album);

        return renderItem({ album, thumbnailAsset, numberOfAssets, elementWidth });
      }}
      keyExtractor={(albumId) => albumId}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={[0]}
    />
  );
}
