import { useState, useLayoutEffect, useEffect } from "react";
import { StyleSheet, SafeAreaView, Text, Pressable, View } from "react-native";
import { handleError } from "services/ErrorHandling";
import to from "await-to-js";
import PostActionSheet from "components/PostActionSheet";
import buttonStyles from "styles/buttonStyles";
import { toPostDataForRepost } from "services/PostDataService";
import PostAssets from "components/PostDetail/PostAssets";
import { loadAssets } from "services/PostAssetDataService";
import { dateToFromNowDaily } from "services/TimeService";

export default function PostDetailScreen({
  navigation,
  route: {
    params: { post },
  },
}) {
  const [postAssets, setPostAssets] = useState([]);

  useEffect(() => {
    loadAssets(post.postAssets)
      .then((postAssets) => setPostAssets(postAssets))
      .catch((err) => handleError("Failed to load asset!", err));
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => {
        return (
          <>
            <Pressable onPress={repost} style={buttonStyles.headerButton}>
              <Text style={buttonStyles.headerButtonText}>Repost</Text>
            </Pressable>
            <PostActionSheet post={post} />
          </>
        );
      },
    });
  }, [navigation]);

  async function repost() {
    const [err, postData] = await to(toPostDataForRepost(post));
    if (err) {
      handleError("Failed to load post data!", err);
      return;
    }
    navigation.navigate("NewPost", { postData, back: "PostIndex" });
  }

  return (
    <SafeAreaView>
      <PostAssets postAssets={postAssets} />
      <View style={styles.container}>
        <Text style={styles.title}>{post.text}</Text>
        <Text style={styles.postedAt}>{dateToFromNowDaily(post.postedAt)}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
  },
  postedAt: {
    marginTop: 5,
    color: "grey",
  },
});
