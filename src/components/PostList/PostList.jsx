import { StyleSheet, FlatList } from "react-native";
import PostListItem from "components/PostList/PostListItem";

export default function PostList({ posts, onPressPost }) {
  return (
    <FlatList
      data={posts}
      renderItem={({ item }) => <PostListItem post={item} onPressPost={onPressPost} />}
      keyExtractor={(item) => item.id}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
});
