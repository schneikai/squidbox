import { useLayoutEffect } from "react";
import { SafeAreaView, Text, Pressable } from "react-native";
import buttonStyles from "styles/buttonStyles";
import PostList from "components/PostList";
import { usePosts } from "services/PostDataService";

export default function PostIndexScreen({ route, navigation }) {
  // TODO: This must use pagination!
  const [posts] = usePosts();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => {
        return (
          <>
            <Pressable onPress={addPost} style={buttonStyles.headerButton}>
              <Text style={buttonStyles.headerButtonText}>Add</Text>
            </Pressable>
            <Pressable onPress={showMoreOptions} style={buttonStyles.headerButton}>
              <Text style={buttonStyles.headerButtonText}>...</Text>
            </Pressable>
          </>
        );
      },
    });
  }, [navigation]);

  function addPost() {
    navigation.navigate("NewPost");
  }

  function showMoreOptions() {}

  function onPressPost(post) {
    navigation.navigate("PostDetail", { post });
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <PostList posts={posts} onPressPost={onPressPost} />
    </SafeAreaView>
  );
}
