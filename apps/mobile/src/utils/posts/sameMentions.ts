import type { PostMention } from '@squidbox/shared';

/** Whether two mention lists are the same, in order (null and [] alike: none). */
export default function sameMentions(
  a: PostMention[] | null | undefined,
  b: PostMention[] | null | undefined,
): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}
