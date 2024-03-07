import { ScrollView, View, StyleSheet, Dimensions } from 'react-native';

import PostableAlbum from './PostableAlbum';
import PostablePost from './PostablePost';

const screenWidth = Dimensions.get('window').width;
const itemWidth = screenWidth / 2.7;

export default function PostablesList({ postables }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollViewStyle}>
      {postables.map((postable, index) => (
        <View key={index} style={[styles.itemContainer, { width: itemWidth }]}>
          {postable.type === 'album' && <PostableAlbum album={postable.album} size={itemWidth} />}
          {postable.type === 'post' && <PostablePost post={postable.post} size={itemWidth} />}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollViewStyle: {
    marginRight: -10,
  },
  itemContainer: {
    marginRight: 10,
  },
});
