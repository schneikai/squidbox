import { useMemo } from 'react';
import { ScrollView, View, StyleSheet, Dimensions } from 'react-native';

import PostAlbum from './PostAlbum';

import useAlbums from '@/features/albums-context/useAlbums';
import getAlbumsByAssetIds from '@/utils/albums/queries/getAlbumsByAssetIds';

const screenWidth = Dimensions.get('window').width;
const itemWidth = screenWidth / 2.7;

export default function PostAlbums({ post }) {
  const { albums } = useAlbums();

  const postAlbums = useMemo(() => {
    if (!post) return [];
    const assetIds = post.assetRefs.map((assetRef) => assetRef.assetId);
    return getAlbumsByAssetIds(assetIds, albums);
  }, [post, albums]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {postAlbums.map((album, index) => (
        <View key={index} style={[styles.itemContainer, { width: itemWidth }]}>
          <PostAlbum album={album} size={itemWidth} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: -10,
  },
  itemContainer: {
    marginRight: 10,
  },
});
