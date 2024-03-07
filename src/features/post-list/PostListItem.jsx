import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';

import PostImage from './PostImage';

import useAssets from '@/features/assets-context/useAssets';
import PostPostedAt from '@/features/posts/PostPostedAt';
import isPresent from '@/utils/isPresent';
import assetRefsToPostAssets from '@/utils/posts/assetRefsToPostAssets';

// import { getPostAssetsWithAssets } from '@/utils/postUtils';

export default function PostListItem({ text, assetRefs, isFavorite, postedAt }) {
  const { assets } = useAssets();
  const [postAssets, setPostAssets] = useState([]);

  useEffect(() => {
    setPostAssets(assetRefsToPostAssets(assetRefs, assets));
  }, [assetRefs]);

  return (
    <View style={styles.container}>
      {isPresent(postAssets) && <PostImage assets={postAssets.map((postAsset) => postAsset.asset)} />}

      {isPresent(text) && <Text style={styles.postText}>{text}</Text>}

      <View style={styles.postInfos}>
        <PostPostedAt postedAt={postedAt} style={styles.postedAt} />
      </View>

      <View style={styles.indicators}>
        <FavoritePostIndicator isFavorite={isFavorite} />
      </View>
    </View>
  );
}

function FavoritePostIndicator({ isFavorite }) {
  if (!isFavorite) return;

  return <Ionicons name="heart" style={styles.favoritePostIndicator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  postText: {
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
  },

  postInfos: {
    marginTop: 10,
  },
  postedAt: {
    fontSize: 12,
    color: 'gray',
    fontWeight: 'bold',
  },

  indicators: {
    position: 'absolute',
    top: 25,
    left: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  favoritePostIndicator: {
    fontSize: 20,
    color: 'white',
  },
});
