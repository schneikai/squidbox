import type { CardsDraft } from './cardsReducer';

import type { PostCardContent } from '@/features/posts/PostCard';
import type { PostFields } from '@/providers/posts/PostsContext';
import type { ThreadPart } from '@/sync/postThreads';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

/** The post as the posts store takes it. */
export type EditedPost = Required<Pick<PostFields, 'text' | 'mentions' | 'assetRefs' | 'postedAt' | 'threadPosts'>>;

/** The post as the posts store takes it, from its cards (the first, then its thread), at `postedAt`. */
export default function postData(
  { cards: [first, ...following] }: Pick<CardsDraft, 'cards'>,
  postedAt: EditedPost['postedAt'],
): EditedPost {
  return {
    text: first!.text,
    mentions: first!.mentions,
    assetRefs: postAssetsToAssetRefs(first!.postAssets),
    postedAt,
    threadPosts: following.map(threadPartOf),
  };
}

function threadPartOf({ id, text, mentions, postAssets }: PostCardContent): ThreadPart {
  return { id, text, mentions, assetRefs: postAssetsToAssetRefs(postAssets) };
}
