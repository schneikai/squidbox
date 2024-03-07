import * as Clipboard from 'expo-clipboard';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';

import PostAssets from './PostAssets';
import PostAlbums from './post-albums/PostAlbums';

import PostPostedAt from '@/features/posts/PostPostedAt';

export default function Post({ post }) {
  async function handleCopyToClipboard() {
    await Clipboard.setStringAsync(post.text);
    Alert.alert('Copied to clipboard');
  }

  return (
    <ScrollView>
      <PostAssets assetRefs={post.assetRefs} />

      <View style={styles.container}>
        <TouchableOpacity onPress={handleCopyToClipboard}>
          <Text style={styles.postText}>{post.text}</Text>
        </TouchableOpacity>
        <PostPostedAt postedAt={post.postedAt} style={styles.postedAt} />

        <View style={styles.postedAlbums}>
          <Text style={styles.postedAlbumsHeadline}>Posted Albums</Text>
          <PostAlbums post={post} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  postedAlbums: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 15,
  },
  postedAlbumsHeadline: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  container: {
    padding: 20,
  },
  postText: {
    fontSize: 16,
    lineHeight: 26,
  },
  postedAt: {
    marginTop: 10,
    fontSize: 12,
    color: 'gray',
    fontWeight: 'bold',
  },
});
