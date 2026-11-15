import type { PostMention } from '@squidbox/shared';

import type { MentionTextValue } from './mentionParts';

/** A place in a text to write over: `from` to `to` (excluded), with a contact's mention (its name written there), or null to drop it. */
export type MentionRange = { from: number; to: number; mention: Pick<PostMention, 'contactId' | 'name'> | null };

/**
 * `text` with each of `ranges` (in order, none overlapping) written over by its mention's name, each
 * mention at the place its name lands; a range without a mention is dropped from the text. Mentions
 * null when there is none.
 */
export default function replaceWithMentions(text: string, ranges: readonly MentionRange[]): MentionTextValue {
  let result = '';
  let at = 0;
  const mentions: PostMention[] = [];
  for (const { from, to, mention } of ranges) {
    result += text.slice(at, from);
    at = to;
    if (!mention) continue;
    mentions.push({ ...mention, location: result.length });
    result += mention.name;
  }
  result += text.slice(at);
  return { text: result, mentions: mentions.length > 0 ? mentions : null };
}
