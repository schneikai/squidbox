import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import readPost from '@/features/post-detail/readPost';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import getTimestamp from '@/utils/date-time/getTimestamp';
import buildPostAssets from '@/utils/posts/buildPostAssets';

// A new post, seeded once from the route: the assets to post (`assetIds`, in that order), a text, or
// the post to repost (`rePostId`: its text and assets, as fresh post assets). Reposting a post that
// was deleted meanwhile closes the editor.
export default function AddPostScreen({ route, navigation }) {
  const { rePostId } = route.params ?? {};
  const { addPost, updatePost } = usePosts();
  const [seed, setSeed] = useState(null);

  useEffect(() => {
    readSeed(getDb(), route.params ?? {}).then((found) => {
      if (found) return setSeed(found);
      Alert.alert('This post was deleted');
      navigation.goBack();
    });
  }, [route.params]);

  async function handleAddPost(data) {
    try {
      await addPost({ ...data, rePostId: rePostId ?? null });
      if (rePostId) await updatePost(rePostId, { hasBeenReposted: true });
      navigation.popToTop();
    } catch (error) {
      Alert.alert('Failed to create post!', error.message);
    }
  }

  if (!seed) return null;

  return <PostEditor post={seed} navigation={navigation} onSave={handleAddPost} />;
}

async function readSeed(db, { rePostId, assetIds, text }) {
  if (rePostId) {
    const rePost = await readPost(db, rePostId);
    if (!rePost) return null;
    const assets = rePost.postAssets.map((postAsset) => postAsset.asset);
    return { text: rePost.text, postAssets: buildPostAssets(assets), postedAt: getTimestamp() };
  }
  const assets = assetIds ? await readByIds(db, schema.assets, assetIds) : [];
  return { text: text ?? '', postAssets: buildPostAssets(assets), postedAt: getTimestamp() };
}
