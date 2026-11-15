import { channelById, type Channel, type PostCopyPost } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useReducer } from 'react';

import EditSheet from '@/components/EditSheet';
import linkTypedHandles from '@/features/post-mentions/linkTypedHandles';
import readContactsByHandle from '@/features/post-mentions/readContactsByHandle';
import PostCards from '@/features/posts/PostCards';
import cardsReducer, { type CardsDraft } from '@/features/posts/draft/cardsReducer';
import draftFromPost, { type CardsSeed } from '@/features/posts/draft/draftFromPost';
import hasCardContent from '@/features/posts/draft/hasCardContent';
import useEditSheet from '@/hooks/useEditSheet';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import usePosts from '@/providers/posts/usePosts';
import type { SyncDb } from '@/sync/db/types';
import readPost from '@/sync/queries/readPost';
import readPostCopies from '@/sync/queries/readPostCopies';
import buildPostAssets from '@/utils/posts/buildPostAssets';
import freshPostAssets from '@/utils/posts/freshPostAssets';

// What the composer opens on: the copy's channel, its posts as cards, and the saved copy's id.
type CopySeed = { channel: Channel; post: CardsSeed; copyId: string | null };

/**
 * A channel copy's composer, pushed in the Send to channels sheet: the post composer's cards
 * (PostCards) with the channel's limits and handles, Add to thread only where the channel has
 * threads. A new copy (`?channelId`) is filled from the post and its thread, each typed @handle that
 * means one contact as its chip (linkTypedHandles), its assets as fresh refs; a saved one (`?copyId`) opens as saved. Add (new) or Save goes back to the list, a sent or
 * deleted copy refusing the save with its reason.
 */
export default function ChannelCopyScreen() {
  const { postId, channelId, copyId } = useLocalSearchParams<{ postId: string; channelId?: string; copyId?: string }>();
  const seed = useSeedOrClose(
    (db) => readSeed(db, { postId, channelId, copyId }),
    `${postId}:${channelId}:${copyId}`,
    'This copy was deleted',
  );

  if (!seed) return null;

  return <CopyComposer postId={postId} seed={seed} />;
}

type CopyComposerProps = { postId: string; seed: CopySeed };

function CopyComposer({ postId, seed }: CopyComposerProps) {
  const { addPostCopy, updatePostCopy } = usePosts();
  const [draft, dispatch] = useReducer(cardsReducer, seed.post, draftFromPost);
  const { channel, copyId } = seed;
  const isNew = copyId === null;
  const seedPosts = useMemo(() => JSON.stringify(copyPosts(draftFromPost(seed.post))), [seed.post]);
  // Worked out once per change of the cards, not on every render.
  const posts = useMemo(() => copyPosts(draft), [draft]);
  const isDirty = useMemo(() => JSON.stringify(posts) !== seedPosts, [posts, seedPosts]);

  const { sheetProps } = useEditSheet({
    isNew,
    isValid: draft.cards.every(hasCardContent),
    isDirty,
    save: () => (isNew ? addPostCopy(postId, { channelId: channel.id, posts }) : updatePostCopy(copyId, posts)),
    syncsItself: true,
  });

  return (
    <EditSheet testID="channel-copy-editor" title={channel.name} {...sheetProps}>
      <PostCards draft={draft} dispatch={dispatch} kind={isNew ? 'draft' : 'edit'} ideas="post" channel={channel} />
    </EditSheet>
  );
}

// The copy's posts as the record holds them, from its cards.
function copyPosts({ cards }: Pick<CardsDraft, 'cards'>): PostCopyPost[] {
  return cards.map(({ text, mentions, postAssets }) => ({
    text,
    mentions,
    assetIds: postAssets.map((postAsset) => postAsset.asset.id),
  }));
}

async function readSeed(
  db: SyncDb,
  { postId, channelId, copyId }: { postId: string; channelId?: string; copyId?: string },
): Promise<CopySeed | null> {
  if (copyId) {
    const [copy] = await readPostCopies(db, postId, { copyId });
    const channel = channelById(copy?.channelId);
    if (!copy || !channel) return null;
    const [first, ...following] = copy.posts.map(({ text, mentions, assets }) => ({
      text,
      mentions,
      postAssets: buildPostAssets(assets),
    }));
    return {
      channel,
      copyId,
      post: { ...first!, threadPosts: following.map((part) => ({ ...part, id: null })) },
    };
  }
  const [stored, ofHandle] = await Promise.all([readPost(db, postId), readContactsByHandle(db)]);
  const channel = channelById(channelId);
  if (!stored || !channel) return null;
  const post = linkTypedHandles(stored, ofHandle);
  return {
    channel,
    copyId: null,
    post: {
      text: post.text,
      mentions: post.mentions,
      postAssets: freshPostAssets(post.postAssets),
      threadPosts: stored.threadPosts.map((part) => {
        const { text, mentions } = linkTypedHandles(part, ofHandle);
        return { id: null, text, mentions, postAssets: freshPostAssets(part.postAssets) };
      }),
    },
  };
}
