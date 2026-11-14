import type { ChannelDraft } from './channelDraftReducer';
import type { EditedPost, PostDraft } from './postDraftReducer';

import type { PostCardContent } from '@/features/posts/PostCard';
import type { ChannelPart } from '@/sync/postChannels';
import type { ThreadPart } from '@/sync/postThreads';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

/** The post as the posts store takes it, at `postedAt`. */
export default function postData(
  draft: Pick<PostDraft, 'main' | 'others'>,
  postedAt: EditedPost['postedAt'],
): EditedPost {
  return {
    ...partsOf(draft.main),
    postedAt,
    channelIds: draft.main.channelIds,
    channelPosts: draft.others.map((other): ChannelPart => ({
      id: other.id,
      channelIds: other.channelIds,
      ...partsOf(other),
    })),
  };
}

// One version's cards as the posts store takes its posts: the first, and its thread.
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
