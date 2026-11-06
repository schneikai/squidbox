import { type NativeStackNavigationProp, useLocalSearchParams, useNavigation } from 'expo-router';
import type { ParamListBase } from 'expo-router/react-navigation';

import leaveWithNewPostSheet from './leaveWithNewPostSheet';

import readPost from '@/features/post-list/readPost';
import PostEditor, { type EditedPost, type PostEditorPost } from '@/features/posts/PostEditor';
import usePosts from '@/features/posts-context/usePosts';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import listParam from '@/lib/listParam';
import { schema } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
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
  const { rePostId, assetIds } = useLocalSearchParams<{ rePostId?: string; assetIds?: string }>();
  const navigation = useNavigation();
  const { addPost, updatePost } = usePosts();
  const seed = useSeedOrClose(
    (db) => readSeed(db, { rePostId, assetIds: listParam(assetIds) }),
    `${rePostId}:${assetIds}`,
    'This post was deleted',
  );

  async function handleAddPost(data: EditedPost) {
    await addPost({ ...data, rePostId });
    if (rePostId) {
      try {
        await updatePost(rePostId, { hasBeenReposted: true });
      } catch (error) {
        console.error("Couldn't mark the post as reposted", error);
      }
    }
    const sheets = navigation.getParent<NativeStackNavigationProp<ParamListBase> | undefined>();
    if (!sheets) throw new Error('The post editor opens inside a sheet');
    return leaveWithNewPostSheet(sheets);
  }

  if (!seed) return null;

  return <PostEditor kind="draft" post={seed} onSave={handleAddPost} />;
}

async function readSeed(
  db: SyncDb,
  { rePostId, assetIds }: { rePostId: string | undefined; assetIds: string[] },
): Promise<PostEditorPost | null> {
  if (rePostId) {
    const rePost = await readPost(db, rePostId);
    if (!rePost) return null;
    const assets = rePost.postAssets.map((postAsset) => postAsset.asset);
    return { text: rePost.text, postAssets: buildPostAssets(assets), postedAt: getTimestamp(), threadPosts: [] };
  }
  const assets = assetIds.length ? await readByIds(db, schema.assets, assetIds) : [];
  return { text: '', postAssets: buildPostAssets(assets), postedAt: getTimestamp(), threadPosts: [] };
}
