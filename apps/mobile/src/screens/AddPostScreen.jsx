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
// was deleted meanwhile closes the editor. Once the post is added, marking the reposted one is
// best-effort: a failure there must not keep the editor open, where Add would add the post again.
export default function AddPostScreen({ route, navigation }) {
  const { rePostId } = route.params ?? {};
  const { addPost, updatePost } = usePosts();
  const seed = useSeedOrClose((db) => readSeed(db, route.params ?? {}), route.params, 'This post was deleted');

  async function handleAddPost(data) {
    await addPost({ ...data, rePostId });
    if (!rePostId) return;
    try {
      await updatePost(rePostId, { hasBeenReposted: true });
    } catch (error) {
      console.error("Couldn't mark the post as reposted", error);
    }
  }

  if (!seed) return null;

  return <PostEditor kind="draft" post={seed} navigation={navigation} onSave={handleAddPost} />;
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
