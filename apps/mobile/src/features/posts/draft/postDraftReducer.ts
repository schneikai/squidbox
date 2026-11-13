import channelDraftReducer, { channelDraftOf, type ChannelDraft, type ChannelDraftAction } from './channelDraftReducer';

import type { PostCardContent } from '@/features/posts/PostCard';
import type { PickedPostedAt } from '@/features/posts/postedAtToSave';
import type { PostFields } from '@/providers/posts/PostsContext';
import type { ChannelPart } from '@/sync/postChannels';
import type { ThreadPart } from '@/sync/postThreads';
import type { PostWithAssets } from '@/sync/queries/postQuery';
import buildPostAssets from '@/utils/posts/buildPostAssets';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

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
 * The editor sheet's draft, shared by its first screen and a channel's step: the post (`main`), its
 * other channels (`others`), the Posted time the user picked (postedAtToSave) and the number the next
 * other channel's key takes.
 */
export type PostDraft = {
  main: ChannelDraft;
  others: OtherChannelDraft[];
  pickedPostedAt: PickedPostedAt;
  nextChannel: number;
};

export type PostDraftAction =
  | { type: 'seed'; post: PostEditorPost }
  | { type: 'main'; action: ChannelDraftAction }
  | { type: 'pickPostedAt'; postedAt: PickedPostedAt }
  | { type: 'putChannel'; channel: OtherChannelDraft }
  | { type: 'removeChannel'; key: string };

/** The sheet's draft: null until the editor seeds it. */
export default function postDraftReducer(draft: PostDraft | null, action: PostDraftAction): PostDraft | null {
  if (action.type === 'seed') return draftFromPost(action.post);
  if (!draft) return draft;
  switch (action.type) {
    case 'main':
      return { ...draft, main: channelDraftReducer(draft.main, action.action) };
    case 'pickPostedAt':
      return { ...draft, pickedPostedAt: action.postedAt };
    case 'putChannel': {
      const { channel } = action;
      if (draft.others.some((other) => other.key === channel.key)) {
        return { ...draft, others: draft.others.map((other) => (other.key === channel.key ? channel : other)) };
      }
      return { ...draft, others: [...draft.others, channel], nextChannel: draft.nextChannel + 1 };
    }
    case 'removeChannel':
      return { ...draft, others: draft.others.filter((other) => other.key !== action.key) };
  }
}

// A post's cards: its own, then one per following post.
function contentsOf(post: PostContent): PostCardContent[] {
  return [
    { id: null, text: post.text, postAssets: post.postAssets },
    ...post.threadPosts.map(({ id, text, postAssets }) => ({ id, text, postAssets })),
  ];
}

const channelKey = (n: number) => `channel-${n}`;

/** The draft of a post as the editor opens it. */
export function draftFromPost(post: PostEditorPost): PostDraft {
  const others = post.channelPosts.flatMap((copy, i) =>
    copy.channelId
      ? [{ ...channelDraftOf(channelKey(i), copy.id, copy.channelId, contentsOf(copy)), channelId: copy.channelId }]
      : [],
  );
  return {
    main: channelDraftOf('main', null, post.channelId ?? null, contentsOf(post)),
    others,
    pickedPostedAt: undefined,
    nextChannel: post.channelPosts.length,
  };
}

// One channel's cards as the posts store takes its posts: the first, and its thread.
function partsOf({ cards: [first, ...following] }: ChannelDraft) {
  return {
    text: first!.text,
    assetRefs: postAssetsToAssetRefs(first!.postAssets),
    threadPosts: following.map(threadPartOf),
  };
}

function threadPartOf({ id, text, postAssets }: PostCardContent): ThreadPart {
  return { id, text, assetRefs: postAssetsToAssetRefs(postAssets) };
}

/** The post as the posts store takes it, at `postedAt`. */
export function postData(draft: Pick<PostDraft, 'main' | 'others'>, postedAt: EditedPost['postedAt']): EditedPost {
  return {
    ...partsOf(draft.main),
    postedAt,
    channelId: draft.main.channelId,
    channelPosts: draft.others.map((other): ChannelPart => ({
      id: other.id,
      channelId: other.channelId,
      ...partsOf(other),
    })),
  };
}

/** The channels the post's parts are on, but the one keyed `exceptKey` (none left out without it). */
export function usedChannelIds(draft: Pick<PostDraft, 'main' | 'others'>, exceptKey?: string): Set<string> {
  return new Set(
    [draft.main, ...draft.others].flatMap((part) => (part.key !== exceptKey && part.channelId ? [part.channelId] : [])),
  );
}

/** The first of the user's channels (`userChannelIds`, in order) the post doesn't use yet; none when all are used. */
export function firstUnusedChannelId(
  draft: Pick<PostDraft, 'main' | 'others'>,
  userChannelIds: string[],
): string | undefined {
  const used = usedChannelIds(draft);
  return userChannelIds.find((id) => !used.has(id));
}

/**
 * A new other channel: on the first of the user's channels the post doesn't use yet, holding the post's
 * first card's text and its media as fresh refs (not its thread); null when every one is used.
 */
export function newChannelDraft(draft: PostDraft, userChannelIds: string[]): OtherChannelDraft | null {
  const channelId = firstUnusedChannelId(draft, userChannelIds);
  if (!channelId) return null;
  const first = draft.main.cards[0]!;
  const postAssets = buildPostAssets(first.postAssets.map((postAsset) => postAsset.asset));
  return {
    ...channelDraftOf(channelKey(draft.nextChannel), null, channelId, [{ id: null, text: first.text, postAssets }]),
    channelId,
  };
}
