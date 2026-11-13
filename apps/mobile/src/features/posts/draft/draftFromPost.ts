import channelDraftOf from './channelDraftOf';
import channelKey from './channelKey';
import type { PostDraft, PostEditorPost } from './postDraftReducer';

import type { PostCardContent } from '@/features/posts/PostCard';

/** The draft of a post as the editor opens it. */
export default function draftFromPost(post: PostEditorPost): PostDraft {
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

// A post's cards: its own, then one per following post.
function contentsOf(post: PostEditorPost | PostEditorPost['channelPosts'][number]): PostCardContent[] {
  return [
    { id: null, text: post.text, postAssets: post.postAssets },
    ...post.threadPosts.map(({ id, text, postAssets }) => ({ id, text, postAssets })),
  ];
}
