import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import PostAssets from './PostAssets';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import AssetAlbums from '@/features/album-list/AssetAlbums';
import WriteWithAi from '@/features/post-chat/WriteWithAi';
import useSubjectChat from '@/features/post-chat/useSubjectChat';
import PostRows from '@/features/post-list/PostRows';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { colors, lineHeights, press, typography } from '@/styles/designTokens';

const OTHER_POSTS_LIMIT = 30;

export default function Post({ post, contentPaddingTop = 0 }) {
  const navigation = useNavigation();
  const sessionId = useSubjectChat({ kind: 'post', text: post.text, postAssets: post.postAssets });

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
        <Pressable style={({ pressed }) => pressed && press.flat} onPress={handleCopyToClipboard}>
          <Text style={styles.postText}>{post.text}</Text>
        </Pressable>
        <PostPostedAt postedAt={post.postedAt} style={styles.postedAt} />
        <WriteWithAi sessionId={sessionId} onOpenChat={(params) => navigation.navigate('PostChat', params)} />

        <View style={styles.related}>
          <ScreenSectionHeader title="Posted Albums" isFlush />
          <AssetAlbums assetIds={post.postAssets.map((postAsset) => postAsset.asset.id)} emptyText="Not in an album" />

          <ScreenSectionHeader title="Other Posts" isFlush />
          <PostRows scope={{ sharesAlbumWithPostId: post.id }} emptyText="No other posts" limit={OTHER_POSTS_LIMIT} />
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
