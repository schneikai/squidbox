import { ScrollView, View, StyleSheet, Dimensions } from 'react-native';

import PostAlbum from './PostAlbum';

import albumQuery from '@/features/album-list/albumQuery';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { useLiveQuery } from '@/sync/useLiveQuery';

const screenWidth = Dimensions.get('window').width;
const itemWidth = screenWidth / 2.7;

// The albums holding any of the post's assets.
export default function PostAlbums({ post }) {
  const { albumSortOrder } = useAppSettings();
  const assetIds = post?.assetRefs.map((assetRef) => assetRef.assetId) ?? [];
  const query = albumQuery({ scope: { assetIds }, assetSort: albumSortOrder });
  const albums = useLiveQuery(query.page, query.tables, [query.descriptor]) ?? [];

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
