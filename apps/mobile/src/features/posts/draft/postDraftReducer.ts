import channelDraftReducer, { type ChannelDraft, type ChannelDraftAction } from './channelDraftReducer';
import draftChannel from './draftChannel';
import newChannelDraft from './newChannelDraft';

import orderPostChannels from '@/features/channels/orderPostChannels';
import type { PickedPostedAt } from '@/features/posts/postedAtToSave';
import type { PostFields } from '@/providers/posts/PostsContext';
import type { PostWithAssets } from '@/sync/queries/postQuery';
import type { ChannelPostRow, PostDetailRow } from '@/sync/queries/readPost';
import freshPostAssets from '@/utils/posts/freshPostAssets';

type PostContent = Pick<PostWithAssets, 'text' | 'postAssets'> & {
  threadPosts: Pick<PostWithAssets, 'id' | 'text' | 'postAssets'>[];
};

/** What the editor is seeded with: a post as readPost reads it, or a new post's seed. */
export type PostEditorPost = PostContent &
  Pick<PostWithAssets, 'postedAt'> &
  Pick<PostDetailRow, 'channelIds'> & {
    channelPosts: (PostContent & Pick<ChannelPostRow, 'id' | 'channelIds'>)[];
  };

/** The post as the posts store takes it. */
export type EditedPost = Required<
  Pick<PostFields, 'text' | 'assetRefs' | 'postedAt' | 'threadPosts' | 'channelIds' | 'channelPosts'>
>;

/**
 * The post editor's draft: the post (`main`), its other versions (`others`), the one that shows
 * (`selectedKey`), the Posted time the user picked (postedAtToSave) and the number the next other
 * version's key takes.
 */
export type PostDraft = {
  main: ChannelDraft;
  others: ChannelDraft[]; // their `channelIds` never empty
  selectedKey: string;
  pickedPostedAt: PickedPostedAt;
  nextChannel: number;
};

export type PostDraftAction =
  | { type: 'channel'; key: string; action: ChannelDraftAction }
  | { type: 'select'; key: string }
  | { type: 'addChannel'; channelId: string }
  | { type: 'splitChannel'; key: string; channelId: string }
  | { type: 'removeVersion'; key: string; channelOrder: string[] }
  | { type: 'pickPostedAt'; postedAt: PickedPostedAt };

/**
 * The post editor's draft. `channel` edits the keyed version (channelDraftReducer: its cards and
 * channels), `select` shows another version, `addChannel` adds a version for one channel holding the
 * first card of the one that shows (newChannelDraft) and shows it, `splitChannel` takes a channel off
 * the keyed version into a new version of its own holding a copy of all its cards and shows it,
 * `removeVersion` drops one and shows the first left in bar order (orderPostChannels over
 * `channelOrder`): removing the post's own version makes the first other one the post. A key the
 * draft doesn't hold throws.
 */
export default function postDraftReducer(draft: PostDraft, action: PostDraftAction): PostDraft {
  switch (action.type) {
    case 'channel': {
      const { key } = draftChannel(draft, action.key);
      if (key === draft.main.key) return { ...draft, main: channelDraftReducer(draft.main, action.action) };
      const others = draft.others.map((other) =>
        other.key === key ? channelDraftReducer(other, action.action) : other,
      );
      return { ...draft, others };
    }
    case 'select':
      return { ...draft, selectedKey: draftChannel(draft, action.key).key };
    case 'addChannel': {
      const { cards } = draftChannel(draft, draft.selectedKey);
      const added = newChannelDraft(draft.nextChannel, action.channelId, cards.slice(0, 1));
      return { ...draft, others: [...draft.others, added], selectedKey: added.key, nextChannel: draft.nextChannel + 1 };
    }
    case 'splitChannel': {
      const source = draftChannel(draft, action.key);
      const added = newChannelDraft(draft.nextChannel, action.channelId, source.cards);
      const left = postDraftReducer(draft, {
        type: 'channel',
        key: source.key,
        action: { type: 'toggleChannel', channelId: action.channelId },
      });
      return { ...left, others: [...left.others, added], selectedKey: added.key, nextChannel: draft.nextChannel + 1 };
    }
    case 'removeVersion': {
      const { key } = draftChannel(draft, action.key);
      const left =
        key === draft.main.key
          ? promoted(draft, action.channelOrder)
          : { main: draft.main, others: draft.others.filter((other) => other.key !== key) };
      return { ...draft, ...left, selectedKey: left.main.key };
    }
    case 'pickPostedAt':
      return { ...draft, pickedPostedAt: action.postedAt };
  }
}

// The post's own version removed: the first other version in bar order becomes the post. It keeps its
// key (its cards stay as they are on screen) but saves as the post's own: no copy id, its thread as new
// posts, its media as new refs (the copy's go with the copy when it is removed).
function promoted(draft: PostDraft, channelOrder: string[]): Pick<PostDraft, 'main' | 'others'> {
  const [, next] = orderPostChannels<ChannelDraft>(
    [draft.main, ...draft.others],
    (part) => part.channelIds,
    channelOrder,
  );
  if (!next) throw new Error("The post's only version can't be removed");
  const main: ChannelDraft = {
    ...next,
    id: null,
    cards: next.cards.map((card) => ({
      ...card,
      id: null,
      postAssets: freshPostAssets(card.postAssets),
    })),
  };
  return { main, others: draft.others.filter((other) => other.key !== next.key) };
}
