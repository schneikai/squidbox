import channelDraftReducer, { type ChannelDraft, type ChannelDraftAction } from './channelDraftReducer';
import draftChannel from './draftChannel';
import newChannelDraft from './newChannelDraft';
import versionOfChannel from './versionOfChannel';

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
  | { type: 'newVersion'; channelId: string; channelOrder: string[] }
  | { type: 'toggleChannel'; key: string; channelId: string; channelOrder: string[] }
  | { type: 'keepChannel'; key: string; channelId: string; channelOrder: string[] }
  | { type: 'removeVersion'; key: string; channelOrder: string[] }
  | { type: 'pickPostedAt'; postedAt: PickedPostedAt };

/**
 * The post editor's draft. `channel` edits the keyed version (channelDraftReducer: its cards and
 * channels), `select` shows another version. `toggleChannel` unticks a channel of the keyed version
 * (its last one throws: the version is removed instead) or ticks one on it, taking it off the version
 * it was on; `keepChannel` makes a channel the keyed version's only one, taking it off the version it
 * was on the same way and unticking the others (they go to no version); both keep the keyed version
 * shown. `newVersion` gives a channel a version of its own holding a copy of all the cards of the one
 * that shows (newChannelDraft) and shows it, taking the channel off the version it was on the same
 * way; the shown version's channel when it is its only one throws (the copy would be itself). A
 * channel taken off a version that had only that channel removes the version, like `removeVersion`.
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
    case 'toggleChannel':
    case 'keepChannel': {
      const { key } = draftChannel(draft, action.key);
      const isOn = versionOfChannel(draft, action.channelId)?.key === key;
      const left = isOn ? draft : takeChannel(draft, action.channelId, action.channelOrder);
      const changed = postDraftReducer(left, {
        type: 'channel',
        key,
        action: { type: action.type, channelId: action.channelId },
      });
      return { ...changed, selectedKey: key };
    }
    case 'newVersion': {
      const { key, cards } = draftChannel(draft, draft.selectedKey);
      const holder = versionOfChannel(draft, action.channelId);
      if (holder?.key === key && holder.channelIds.length === 1) {
        throw new Error('The shown version is already this channel alone');
      }
      const left = takeChannel(draft, action.channelId, action.channelOrder);
      const added = newChannelDraft(draft.nextChannel, action.channelId, cards);
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

// The draft with `channelId` taken off the version it is on: a version that had only that channel is
// removed (removeVersion).
function takeChannel(draft: PostDraft, channelId: string, channelOrder: string[]): PostDraft {
  const holder = versionOfChannel(draft, channelId);
  if (!holder) return draft;
  if (holder.channelIds.length === 1) {
    return postDraftReducer(draft, { type: 'removeVersion', key: holder.key, channelOrder });
  }
  return postDraftReducer(draft, { type: 'channel', key: holder.key, action: { type: 'toggleChannel', channelId } });
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
