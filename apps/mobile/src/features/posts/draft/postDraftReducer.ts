import channelDraftReducer, { type ChannelDraft, type ChannelDraftAction } from './channelDraftReducer';
import draftChannel from './draftChannel';
import newChannelDraft from './newChannelDraft';

import orderPostChannels from '@/features/channels/orderPostChannels';
import type { PickedPostedAt } from '@/features/posts/postedAtToSave';
import type { PostFields } from '@/providers/posts/PostsContext';
import type { PostWithAssets } from '@/sync/queries/postQuery';
import buildPostAssets from '@/utils/posts/buildPostAssets';

type PostContent = Pick<PostWithAssets, 'text' | 'postAssets'> & {
  threadPosts: Pick<PostWithAssets, 'id' | 'text' | 'postAssets'>[];
};

/** What the editor is seeded with: a post as readPost reads it, or a new post's seed. */
export type PostEditorPost = PostContent &
  Pick<PostWithAssets, 'postedAt' | 'channelId'> & {
    channelPosts: (PostContent & Pick<PostWithAssets, 'id' | 'channelId'>)[];
  };

/** The post as the posts store takes it. */
export type EditedPost = Required<
  Pick<PostFields, 'text' | 'assetRefs' | 'postedAt' | 'threadPosts' | 'channelId' | 'channelPosts'>
>;

/** Another channel of the post: it always has one. */
export type OtherChannelDraft = ChannelDraft & { channelId: string };

/**
 * The post editor's draft: the post (`main`), its other channels (`others`), the one that shows
 * (`selectedKey`), the Posted time the user picked (postedAtToSave) and the number the next other
 * channel's key takes.
 */
export type PostDraft = {
  main: ChannelDraft;
  others: OtherChannelDraft[];
  selectedKey: string;
  pickedPostedAt: PickedPostedAt;
  nextChannel: number;
};

export type PostDraftAction =
  | { type: 'channel'; key: string; action: ChannelDraftAction }
  | { type: 'select'; key: string }
  | { type: 'addChannel'; channelId: string }
  | { type: 'removeChannel'; key: string; channelOrder: string[] }
  | { type: 'pickPostedAt'; postedAt: PickedPostedAt };

/**
 * The post editor's draft. `channel` edits the keyed channel's cards (channelDraftReducer), `select`
 * shows another channel, `addChannel` adds one as a copy of the one that shows (newChannelDraft) and
 * shows it, `removeChannel` drops one and shows the first left in bar order (orderPostChannels over
 * `channelOrder`): removing the post's own channel makes the first other one the post. A key the draft
 * doesn't hold throws.
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
      const added = newChannelDraft(draft, action.channelId);
      return { ...draft, others: [...draft.others, added], selectedKey: added.key, nextChannel: draft.nextChannel + 1 };
    }
    case 'removeChannel': {
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

// The post's own channel removed: the first other channel in bar order becomes the post. It keeps its
// key (its cards stay as they are on screen) but saves as the post's own: no copy id, its thread as new
// posts, its media as new refs (the copy's go with the copy when it is removed).
function promoted(draft: PostDraft, channelOrder: string[]): Pick<PostDraft, 'main' | 'others'> {
  const [, next] = orderPostChannels<ChannelDraft>(
    [draft.main, ...draft.others],
    (part) => part.channelId,
    channelOrder,
  );
  if (!next) throw new Error("The post's only channel can't be removed");
  const main: ChannelDraft = {
    ...next,
    id: null,
    cards: next.cards.map((card) => ({
      ...card,
      id: null,
      postAssets: buildPostAssets(card.postAssets.map((postAsset) => postAsset.asset)),
    })),
  };
  return { main, others: draft.others.filter((other) => other.key !== next.key) };
}
