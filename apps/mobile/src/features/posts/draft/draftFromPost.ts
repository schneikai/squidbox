import type { CardsDraft } from './cardsReducer';
import nextCardKey from './nextCardKey';

import type { PostCardContent } from '@/features/posts/PostCard';
import type { PostWithAssets } from '@/sync/queries/postQuery';

/** What the editor is seeded with: a post as readPost reads it, or a new post's seed. */
export type PostEditorPost = Pick<PostWithAssets, 'text' | 'postAssets' | 'postedAt'> & {
  threadPosts: Pick<PostWithAssets, 'id' | 'text' | 'postAssets'>[];
};

/** A post's cards as the editor opens them: its own, then one per following post. */
export default function draftFromPost(post: Omit<PostEditorPost, 'postedAt'>): CardsDraft {
  const contents: PostCardContent[] = [
    { id: null, text: post.text, postAssets: post.postAssets },
    ...post.threadPosts.map(({ id, text, postAssets }) => ({ id, text, postAssets })),
  ];
  const cards = contents.map((content, i) => ({ ...content, key: nextCardKey({ nextCard: i }) }));
  return { cards, nextCard: cards.length };
}
