import channelDraftOf from './channelDraftOf';
import channelKey, { MAIN_KEY } from './channelKey';
import type { PostDraft, PostEditorPost } from './postDraftReducer';

import type { PostCardContent } from '@/features/posts/PostCard';

/**
 * The draft of a post as the editor opens it, showing the other version saved as
 * `selectedChannelPostId` (the one the post screen showed), else the post's own.
 */
export default function draftFromPost(post: PostEditorPost, selectedChannelPostId?: string): PostDraft {
  const others = post.channelPosts.map((copy, i) =>
    channelDraftOf(channelKey(i), copy.id, copy.channelIds, contentsOf(copy)),
  );
  const main = channelDraftOf(MAIN_KEY, null, post.channelIds, contentsOf(post));
  const selected = others.find((other) => other.id === selectedChannelPostId);
  return {
    main,
    others,
    selectedKey: selected?.key ?? main.key,
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
