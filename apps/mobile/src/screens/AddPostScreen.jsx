import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import postQuery from '@/features/post-list/postQuery';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import getTimestamp from '@/utils/date-time/getTimestamp';
import buildPostAssets from '@/utils/posts/buildPostAssets';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';
import postSchema from '@/utils/posts/postSchema';

// A new post, seeded once from the route: the assets to post (`assetIds`), a text, or the post to
// repost (`rePostId`: its text and assets, as fresh post assets).
export default function AddPostScreen({ route, navigation }) {
  const { rePostId } = route.params ?? {};
  const { addPost, updatePost } = usePosts();
  const [post, setPost] = useState(null);

  useEffect(() => {
    readSeed(getDb(), route.params ?? {}).then(setPost);
  }, [route.params]);

  if (!post) return null;

  const data = { text: post.text, assetRefs: postAssetsToAssetRefs(post.postAssets), postedAt: post.postedAt };

  async function handleAddPost() {
    try {
      await addPost({ ...data, rePostId: rePostId ?? null });
      if (rePostId) await updatePost(rePostId, { hasBeenReposted: true });
      navigation.popToTop();
    } catch (error) {
      Alert.alert('Failed to create post!', error.message);
    }
  }

  function canAddPost() {
    try {
      postSchema.validateSync(data);
      return true;
    } catch (_e) {
      return false;
    }
  }

  return (
    <PostEditor post={post} onChange={setPost} navigation={navigation} onSave={handleAddPost} canSave={canAddPost()} />
  );
}

async function readSeed(db, { rePostId, assetIds, text }) {
  if (rePostId) {
    const [rePost] = (await postQuery({ scope: { postId: rePostId } }).read(db, { limit: 1 })).rows;
    const assets = rePost?.postAssets.map((postAsset) => postAsset.asset) ?? [];
    return { text: rePost?.text ?? '', postAssets: buildPostAssets(assets), postedAt: getTimestamp() };
  }
  const assets = assetIds ? await readByIds(db, schema.assets, assetIds) : [];
  return { text: text ?? '', postAssets: buildPostAssets(assets), postedAt: getTimestamp() };
}
