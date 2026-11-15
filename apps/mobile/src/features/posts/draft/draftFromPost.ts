import type { CardsDraft } from './cardsReducer';
import nextCardKey from './nextCardKey';

import type { PostCardContent } from '@/features/posts/PostCard';
import type { PostWithAssets } from '@/sync/queries/postQuery';

/** What the editor is seeded with: a post as readPost reads it, or a new post's seed. */
export type PostEditorPost = Pick<PostWithAssets, 'text' | 'mentions' | 'postAssets' | 'postedAt'> & {
  threadPosts: Pick<PostWithAssets, 'id' | 'text' | 'mentions' | 'postAssets'>[];
};

/** A post and its thread as cards open on them; a following post not saved as one (a copy's) has a null id. */
export type CardsSeed = Pick<PostEditorPost, 'text' | 'mentions' | 'postAssets'> & {
  threadPosts: (Omit<PostEditorPost['threadPosts'][number], 'id'> & { id: string | null })[];
};

/** A post's cards as the editor opens them: its own, then one per following post. */
export default function draftFromPost(post: CardsSeed): CardsDraft {
  const contents: PostCardContent[] = [
    { id: null, text: post.text, mentions: post.mentions, postAssets: post.postAssets },
    ...post.threadPosts.map(({ id, text, mentions, postAssets }) => ({ id, text, mentions, postAssets })),
  ];
  const cards = contents.map((content, i) => ({ ...content, key: nextCardKey({ nextCard: i }) }));
  return { cards, nextCard: cards.length };
}
