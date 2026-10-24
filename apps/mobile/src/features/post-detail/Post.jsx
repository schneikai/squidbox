import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';

import PostAssets from './PostAssets';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import PostRows from '@/features/post-list/PostRows';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { colors, lineHeights, typography } from '@/styles/designTokens';

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

        <View style={styles.related}>
          <ScreenSectionHeader title="Posted Albums" isFlush />
          <AssetAlbums assetIds={post.postAssets.map((postAsset) => postAsset.asset.id)} emptyText="Not in an album" />

          <ScreenSectionHeader title="Other Posts" isFlush />
          <PostRows scope={{ sharesAlbumWithPostId: post.id }} emptyText="No other posts" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  related: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border.glass,
  },

  container: {
    padding: 20,
  },
  postText: {
    fontSize: typography.callout,
    lineHeight: lineHeights.reading,
  },
  postedAt: {
    marginTop: 10,
  },
});
