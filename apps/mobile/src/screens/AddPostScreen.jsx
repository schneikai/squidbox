import { Alert } from 'react-native';

import readPost from '@/features/post-detail/readPost';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import getTimestamp from '@/utils/date-time/getTimestamp';
import buildPostAssets from '@/utils/posts/buildPostAssets';

// A new post, seeded once from the route: the assets to post (`assetIds`, in that order), a text, or
// the post to repost (`rePostId`: its text and assets, as fresh post assets). Reposting a post that
// was deleted meanwhile closes the editor.
export default function AddPostScreen({ route, navigation }) {
  const { rePostId } = route.params ?? {};
  const { addPost, updatePost } = usePosts();
  const seed = useSeedOrClose((db) => readSeed(db, route.params ?? {}), route.params, 'This post was deleted');

  async function handleAddPost(data) {
    try {
      await addPost({ ...data, rePostId });
      if (rePostId) await updatePost(rePostId, { hasBeenReposted: true });
      navigation.getParent().goBack(); // closes this editor only, not one it was opened over
    } catch (error) {
      Alert.alert('Failed to create post!', error.message);
    }
  }

  if (!seed) return null;

  return <PostEditor post={seed} navigation={navigation} onSave={handleAddPost} />;
}

async function readSeed(db, { rePostId, assetIds }) {
  if (rePostId) {
    const rePost = await readPost(db, rePostId);
    if (!rePost) return null;
    const assets = rePost.postAssets.map((postAsset) => postAsset.asset);
    return { text: rePost.text, postAssets: buildPostAssets(assets), postedAt: getTimestamp() };
  }
  const assets = assetIds ? await readByIds(db, schema.assets, assetIds) : [];
  return { text: '', postAssets: buildPostAssets(assets), postedAt: getTimestamp() };
}
