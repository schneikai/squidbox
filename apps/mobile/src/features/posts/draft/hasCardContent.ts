import type { PostCardContent } from '@/features/posts/PostCard';

/** A post needs text or at least one photo. */
export default function hasCardContent({ text, postAssets }: Pick<PostCardContent, 'text' | 'postAssets'>): boolean {
  return Boolean(text) || postAssets.length > 0;
}
