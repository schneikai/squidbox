import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';

import PostAssets from './PostAssets';

import AssetAlbums from '@/features/album-list/AssetAlbums';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { colors, typography } from '@/styles/designTokens';

export default function Post({ post, contentPaddingTop = 0 }) {
  const navigation = useNavigation();

  // Pushed, so back returns to the post.
  function handleOpenAsset(asset) {
    navigation.push('AssetScreen', { assetId: asset.id, query: { scope: { postId: post.id } } });
  }

  async function handleCopyToClipboard() {
    await Clipboard.setStringAsync(post.text);
    Alert.alert('Copied to clipboard');
  }

  return (
    <ScrollView contentContainerStyle={{ paddingTop: contentPaddingTop }}>
      <PostAssets postAssets={post.postAssets} onPressAsset={handleOpenAsset} />

      <View style={styles.container}>
        <TouchableOpacity onPress={handleCopyToClipboard}>
          <Text style={styles.postText}>{post.text}</Text>
        </TouchableOpacity>
        <PostPostedAt postedAt={post.postedAt} style={styles.postedAt} />

        <View style={styles.postedAlbums}>
          <Text style={styles.postedAlbumsHeadline}>Posted Albums</Text>
          <AssetAlbums assetIds={post.postAssets.map((postAsset) => postAsset.asset.id)} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  postedAlbums: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    paddingTop: 15,
  },
  postedAlbumsHeadline: {
    fontSize: typography.callout,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  container: {
    padding: 20,
  },
  postText: {
    fontSize: typography.callout,
    lineHeight: 26,
  },
  postedAt: {
    marginTop: 10,
  },
});
