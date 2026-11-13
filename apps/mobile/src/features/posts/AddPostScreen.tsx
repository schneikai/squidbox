import { useLocalSearchParams, useNavigation } from 'expo-router';

import leaveWithNewPostSheet from './leaveWithNewPostSheet';

import PostEditor from '@/features/posts/PostEditor';
import type { EditedPost, PostEditorPost } from '@/features/posts/draft/postDraftReducer';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import listParam from '@/lib/listParam';
import usePosts from '@/providers/posts/usePosts';
import { readChannels } from '@/sync/channelsRepository';
import { schema } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import readPost from '@/sync/queries/readPost';
import { readByIds } from '@/sync/readByIds';
import getTimestamp from '@/utils/date-time/getTimestamp';
import buildPostAssets from '@/utils/posts/buildPostAssets';
import freshPostAssets from '@/utils/posts/freshPostAssets';

// A new post, seeded once from the route: the assets to post (`assetIds`, comma-separated, in that
// order), or the post to repost (`rePostId`: its first post's text and assets, as fresh post assets,
// without its thread or its other channels). It is on the reposted post's channel, else the user's
// first channel, else none. Reposting a post that was deleted meanwhile closes the editor. Once the post is added,
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
    return leaveWithNewPostSheet(navigation);
  }

  if (!seed) return null;

  return <PostEditor kind="draft" ideas={rePostId ? 'repost' : 'post'} post={seed} onSave={handleAddPost} />;
}

async function readSeed(
  db: SyncDb,
  { rePostId, assetIds }: { rePostId: string | undefined; assetIds: string[] },
): Promise<PostEditorPost | null> {
  const [firstChannel] = await readChannels(db);
  const channelId = firstChannel?.channelId ?? null;
  const fresh = { postedAt: getTimestamp(), threadPosts: [], channelPosts: [] };
  if (rePostId) {
    const rePost = await readPost(db, rePostId, { withChannels: false });
    if (!rePost) return null;
    return {
      ...fresh,
      text: rePost.text,
      postAssets: freshPostAssets(rePost.postAssets),
      channelId: rePost.channelId ?? channelId,
    };
  }
  const assets = assetIds.length ? await readByIds(db, schema.assets, assetIds) : [];
  return { ...fresh, text: '', postAssets: buildPostAssets(assets), channelId };
}
