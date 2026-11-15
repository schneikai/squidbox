import type { MentionTextValue } from './mentionParts';

/** The contacts the chips of `posts` mention, by id, each once, in the order first seen (stored mentions, valid or not). */
export default function chipContactIds(posts: readonly MentionTextValue[]): string[] {
  return [...new Set(posts.flatMap(({ mentions }) => (mentions ?? []).map(({ contactId }) => contactId)))];
}
