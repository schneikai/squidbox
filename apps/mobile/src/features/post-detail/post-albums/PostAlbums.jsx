import { ScrollView, View, StyleSheet, Dimensions } from 'react-native';

import PostAlbum from './PostAlbum';

import useAlbumRows from '@/features/album-list/useAlbumRows';

const screenWidth = Dimensions.get('window').width;
const itemWidth = screenWidth / 2.7;

// The albums holding any of the post's assets.
export default function PostAlbums({ post }) {
  const albums = useAlbumRows({ assetIds: post.postAssets.map((postAsset) => postAsset.asset.id) }) ?? [];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {albums.map((album) => (
        <View key={album.id} style={[styles.itemContainer, { width: itemWidth }]}>
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
