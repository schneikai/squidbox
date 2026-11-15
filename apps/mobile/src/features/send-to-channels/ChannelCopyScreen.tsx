import type { PostCopyPost } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useReducer } from 'react';

import copyAsPost from './copyAsPost';

import EditSheet from '@/components/EditSheet';
import PostCards from '@/features/posts/PostCards';
import cardsReducer, { type CardsDraft } from '@/features/posts/draft/cardsReducer';
import draftFromPost, { type CardsSeed } from '@/features/posts/draft/draftFromPost';
import hasCardContent from '@/features/posts/draft/hasCardContent';
import useEditSheet from '@/hooks/useEditSheet';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import usePosts from '@/providers/posts/usePosts';
import type { SyncDb } from '@/sync/db/types';
import { REMOVED } from '@/sync/postCopiesRepository';
import { readChannelCopy, type ChannelCopy } from '@/sync/queries/readChannelCopies';
import postAsCopyPosts from '@/utils/posts/postAsCopyPosts';

// What the composer opens on: the card, and its posts as cards.
type CopySeed = { copy: ChannelCopy; post: CardsSeed };

/**
 * A channel copy's composer, pushed in the Send to channels sheet: the post composer's cards
 * (PostCards) with the channel's limits and handles, Add to thread only where the channel has
 * threads. It opens on the card as it shows (one that follows the post shows the post and its
 * thread). Save stores it as the channel's own copy and goes back to the list, a sent or removed copy
 * refusing the save with its reason.
 */
export default function ChannelCopyScreen() {
  const { postId, copyId } = useLocalSearchParams<{ postId: string; copyId: string }>();
  const seed = useSeedOrClose((db) => readSeed(db, postId, copyId), `${postId}:${copyId}`, REMOVED);

  if (!seed) return null;

  return <CopyComposer seed={seed} />;
}

type CopyComposerProps = { seed: CopySeed };

function CopyComposer({ seed }: CopyComposerProps) {
  const { savePostCopy } = usePosts();
  const [draft, dispatch] = useReducer(cardsReducer, seed.post, draftFromPost);
  const { copy } = seed;
  const { channel } = copy;
  const seedPosts = useMemo(() => JSON.stringify(recordPosts(draftFromPost(seed.post))), [seed.post]);
  // Worked out once per change of the cards, not on every render.
  const posts = useMemo(() => recordPosts(draft), [draft]);
  const isDirty = useMemo(() => JSON.stringify(posts) !== seedPosts, [posts, seedPosts]);

  const { sheetProps } = useEditSheet({
    isValid: draft.cards.every(hasCardContent),
    isDirty,
    save: () => savePostCopy(copy, posts),
    syncsItself: true,
  });

  return (
    <EditSheet testID="channel-copy-editor" title={channel.name} {...sheetProps}>
      <PostCards
        draft={draft}
        dispatch={dispatch}
        kind={copy.showsPost ? 'draft' : 'edit'}
        ideas="post"
        channel={channel}
      />
    </EditSheet>
  );
}

async function readSeed(db: SyncDb, postId: string, copyId: string): Promise<CopySeed | null> {
  const copy = await readChannelCopy(db, postId, copyId);
  const post = copy && copyAsPost(copy);
  return post ? { copy, post } : null;
}

// The copy's posts as the record holds them, from its cards.
function recordPosts({ cards }: Pick<CardsDraft, 'cards'>): PostCopyPost[] {
  return postAsCopyPosts(cards).map(({ text, mentions, assetIds }) => ({ text, mentions, assetIds }));
}
