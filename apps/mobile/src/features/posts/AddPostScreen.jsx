import { useLocalSearchParams, useNavigation } from 'expo-router';

import readPost from '@/features/post-list/readPost';
import PostEditor from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import listParam from '@/lib/listParam';
import { schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import getTimestamp from '@/utils/date-time/getTimestamp';
import buildPostAssets from '@/utils/posts/buildPostAssets';

// A new post, seeded once from the route: the assets to post (`assetIds`, comma-separated, in that
// order), or the post to repost (`rePostId`: its first post's text and assets, as fresh post assets,
// without its thread). Reposting a post that was deleted meanwhile closes the editor. Once the post is added,
// marking the reposted one is best-effort: a failure there must not keep the editor open, where Add
// would add the post again. Added from the New post sheet, the post closes that sheet too: the user
// lands on the posts list with the new post, not back on what to post next.
export default function AddPostScreen() {
  const { rePostId, assetIds } = useLocalSearchParams();
  const navigation = useNavigation();
  const { addPost, updatePost } = usePosts();
  const seed = useSeedOrClose(
    (db) => readSeed(db, { rePostId, assetIds: assetIds && listParam(assetIds) }),
    `${rePostId}:${assetIds}`,
    'This post was deleted',
  );

  async function handleAddPost(data) {
    await addPost({ ...data, rePostId });
    if (rePostId) {
      try {
        await updatePost(rePostId, { hasBeenReposted: true });
      } catch (error) {
        console.error("Couldn't mark the post as reposted", error);
      }
    }
    return leaveWithNewPostSheet(navigation.getParent());
  }

  if (!seed) return null;

  return <PostEditor kind="draft" post={seed} onSave={handleAddPost} />;
}

// Closes the editor sheet and, when it was opened over the New post sheet, that sheet too (useEditSheet
// leaves with a returned function). Otherwise undefined: the editor goes back to where it was opened.
function leaveWithNewPostSheet(sheets) {
  const { routes, index } = sheets.getState();
  if (routes[index - 1]?.name !== '(new-post)') return undefined;
  return () => sheets.pop(2);
}

async function readSeed(db, { rePostId, assetIds }) {
  if (rePostId) {
    const rePost = await readPost(db, rePostId);
    if (!rePost) return null;
    const assets = rePost.postAssets.map((postAsset) => postAsset.asset);
    return { text: rePost.text, postAssets: buildPostAssets(assets), postedAt: getTimestamp(), threadPosts: [] };
  }
  const assets = assetIds ? await readByIds(db, schema.assets, assetIds) : [];
  return { text: '', postAssets: buildPostAssets(assets), postedAt: getTimestamp(), threadPosts: [] };
}
