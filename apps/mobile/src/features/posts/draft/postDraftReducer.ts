import channelDraftReducer, { type ChannelDraft, type ChannelDraftAction } from './channelDraftReducer';
import draftFromPost from './draftFromPost';

import type { PickedPostedAt } from '@/features/posts/postedAtToSave';
import type { PostFields } from '@/providers/posts/PostsContext';
import type { PostWithAssets } from '@/sync/queries/postQuery';

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
