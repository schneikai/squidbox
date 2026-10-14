import { useState } from 'react';
import { Alert } from 'react-native';

import postQuery from '@/features/post-list/postQuery';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';
import getTimestamp from '@/utils/date-time/getTimestamp';
import buildPostAssets from '@/utils/posts/buildPostAssets';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';
import postSchema from '@/utils/posts/postSchema';

// A new post, seeded from the route: the assets to post (`assetIds`), a text, or the post to repost
// (`rePostId`: its text and assets, as fresh post assets).
export default function AddPostScreen({ route, navigation }) {
  const { rePostId, assetIds, text: prefilledText } = route.params ?? {};
  const { addPost, updatePost } = usePosts();
  const [postData, setPostData] = useState(null);

  const seed = useLiveQuery(
    async (db) => {
      if (rePostId) {
        const [rePost] = (await postQuery({ scope: { postId: rePostId } }).read(db, { limit: 1 })).rows;
        const assets = rePost?.postAssets.map((postAsset) => postAsset.asset) ?? [];
        return { text: rePost?.text ?? '', postAssets: buildPostAssets(assets) };
      }
      const assets = assetIds ? await readByIds(db, schema.assets, assetIds) : [];
      return { text: prefilledText ?? '', postAssets: buildPostAssets(assets) };
    },
    [schema.posts, schema.postAssets, schema.assets],
    [rePostId, assetIds, prefilledText],
  );

  if (!seed) return null;

  const initialPost = { ...seed, postedAt: getTimestamp() };
  const post = postData ?? { ...initialPost, assetRefs: postAssetsToAssetRefs(initialPost.postAssets) };

  async function handleAddPost() {
    try {
      await addPost({
        text: post.text,
        assetRefs: post.assetRefs,
        postedAt: post.postedAt,
        rePostId: rePostId ?? null,
      });
      if (rePostId) await updatePost(rePostId, { hasBeenReposted: true });
      navigation.popToTop();
    } catch (error) {
      Alert.alert('Failed to create post!', error.message);
    }
  }

  function canAddPost() {
    try {
      postSchema.validateSync(post);
      return true;
    } catch (_e) {
      return false;
    }
  }

  return (
    <PostEditor
      post={initialPost}
      onChange={setPostData}
      navigation={navigation}
      onSave={handleAddPost}
      canSave={canAddPost()}
    />
  );
}
