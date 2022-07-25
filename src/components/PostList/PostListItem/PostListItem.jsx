import { useEffect, useState } from "react";
import { StyleSheet, Pressable, Text } from "react-native";
import { dateToFromNowDaily } from "services/TimeService";
import PostImage from "components/PostList/PostImage";
import { loadAssets } from "services/PostAssetDataService";

export default function PostListItem({ post, onPressPost }) {
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    loadAssets(post.postAssets, { limit: 4 })
      .then((postAssets) => setAssets(postAssets.map((postAsset) => postAsset.asset)))
      .catch((err) => handleError("Failed to load asset!", err));
  }, []);

  return (
    <Pressable onPress={() => onPressPost(post)} style={styles.container}>
      <Text style={styles.postedAt}>{dateToFromNowDaily(post.postedAt)}</Text>
      <Text style={styles.text}>{post.text}</Text>
      {assets && assets.length > 0 && (
        <PostImage assets={assets} totalAssets={post.postAssets.length} style={styles.image} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  postedAt: {
    fontSize: 14,
    color: "grey",
  },
  text: {
    fontSize: 14,
    marginTop: 5,
    lineHeight: 18,
    marginBottom: 8,
  },
});
