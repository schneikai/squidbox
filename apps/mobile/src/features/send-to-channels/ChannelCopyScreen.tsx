import { channelById, type Channel, type PostCopyPost } from '@squidbox/shared';
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
import { readChannelCopy, type ChannelCopy } from '@/sync/queries/readChannelCopies';

// What the composer opens on: the card's channel, its posts as cards, and the card itself.
type CopySeed = { channel: Channel; post: CardsSeed; copy: ChannelCopy };

/**
 * A channel copy's composer, pushed in the Send to channels sheet: the post composer's cards
 * (PostCards) with the channel's limits and handles, Add to thread only where the channel has
 * threads. It opens on the card as it shows (an untouched card shows the post and its thread). Save
 * stores it as the channel's own copy and goes back to the list, a sent or removed copy refusing the
 * save with its reason.
 */
export default function ChannelCopyScreen() {
  const { postId, copyId } = useLocalSearchParams<{ postId: string; copyId: string }>();
  const seed = useSeedOrClose((db) => readSeed(db, postId, copyId), `${postId}:${copyId}`, 'This copy was deleted');

  if (!seed) return null;

  return <CopyComposer seed={seed} />;
}

type CopyComposerProps = { seed: CopySeed };

function CopyComposer({ seed }: CopyComposerProps) {
  const { savePostCopy } = usePosts();
  const [draft, dispatch] = useReducer(cardsReducer, seed.post, draftFromPost);
  const { channel, copy } = seed;
  const seedPosts = useMemo(() => JSON.stringify(copyPosts(draftFromPost(seed.post))), [seed.post]);
  // Worked out once per change of the cards, not on every render.
  const posts = useMemo(() => copyPosts(draft), [draft]);
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
        kind={copy.followsPost ? 'draft' : 'edit'}
        ideas="post"
        channel={channel}
      />
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

async function readSeed(db: SyncDb, postId: string, copyId: string): Promise<CopySeed | null> {
  const copy = await readChannelCopy(db, postId, copyId);
  const channel = channelById(copy?.channelId);
  if (!copy || !channel) return null;
  const post = copyAsPost(copy);
  return post && { channel, copy, post };
}
