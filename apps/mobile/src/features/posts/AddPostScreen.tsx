import { useLocalSearchParams, useNavigation } from 'expo-router';

import leaveWithNewPostSheet from './leaveWithNewPostSheet';

import PostEditor from '@/features/posts/PostEditor';
import type { PostEditorPost } from '@/features/posts/draft/draftFromPost';
import type { EditedPost } from '@/features/posts/draft/postData';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import listParam from '@/lib/listParam';
import type { PostCopyFields } from '@/providers/posts/PostsContext';
import usePosts from '@/providers/posts/usePosts';
import { schema } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import readPost from '@/sync/queries/readPost';
import readPostCopies from '@/sync/queries/readPostCopies';
import { readByIds } from '@/sync/readByIds';
import getTimestamp from '@/utils/date-time/getTimestamp';
import buildPostAssets from '@/utils/posts/buildPostAssets';
import freshPostAssets from '@/utils/posts/freshPostAssets';

// A new post, seeded once from the route: the assets to post (`assetIds`, comma-separated, in that
// order), or the post to repost (`rePostId`: its first post's text and assets, as fresh post assets,
// without its thread, and the channel copies the user saved, held here beside the editor and added
// with the post, unsent: the new post's own from then on; its other channels get cards that follow
// the new post). Reposting a post that was deleted meanwhile closes the editor. Once the post is added,
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
    await addPost({ ...data, rePostId, copies: seed?.copies });
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

  return <PostEditor kind="draft" ideas={rePostId ? 'repost' : 'post'} post={seed.post} onSave={handleAddPost} />;
}

// A new post's seed: the post for the editor, and the copies a repost starts with.
type NewPostSeed = { post: PostEditorPost; copies: PostCopyFields[] };

async function readSeed(
  db: SyncDb,
  { rePostId, assetIds }: { rePostId: string | undefined; assetIds: string[] },
): Promise<NewPostSeed | null> {
  const fresh = { postedAt: getTimestamp(), threadPosts: [] };
  if (rePostId) {
    // One transaction: the post and its copies as of one moment.
    const read = await db.transaction(async (tx) => {
      const post = await readPost(tx, rePostId);
      return post && { post, copies: await readPostCopies(tx, rePostId) };
    });
    if (!read) return null;
    const { post: rePost } = read;
    // The copies the user saved, not those taken off the post; its other channels' cards follow the repost.
    const copies = read.copies
      .filter((copy) => copy.editedAt != null && copy.removedAt == null)
      .map(({ channelId, posts, editedAt }) => ({
        channelId,
        posts: posts.map(({ text, mentions, assetIds }) => ({ text, mentions, assetIds })),
        editedAt,
      }));
    return {
      post: { ...fresh, text: rePost.text, mentions: rePost.mentions, postAssets: freshPostAssets(rePost.postAssets) },
      copies,
    };
  }
  const assets = assetIds.length ? await readByIds(db, schema.assets, assetIds) : [];
  return { post: { ...fresh, text: '', mentions: null, postAssets: buildPostAssets(assets) }, copies: [] };
}
