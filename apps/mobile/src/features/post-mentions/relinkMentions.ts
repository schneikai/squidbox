import type { PostMention } from '@squidbox/shared';

import mentionParts, { type MentionTextValue } from './mentionParts';

/**
 * The mentions of `value` that still stand in `text` (a text written over it, the assistant's Use):
 * each valid chip, in its order, at the first place its name stands that no earlier chip took; a
 * chip whose name is gone is dropped (its words, if any, are plain text). Null when none is left.
 */
export default function relinkMentions(value: MentionTextValue, text: string): PostMention[] | null {
  const taken: [number, number][] = [];
  const relinked: PostMention[] = [];
  for (const part of mentionParts(value.text, value.mentions)) {
    if (part.kind !== 'mention') continue;
    const { name } = part.mention;
    let location = text.indexOf(name);
    while (location >= 0 && taken.some(([start, end]) => location < end && location + name.length > start)) {
      location = text.indexOf(name, location + 1);
    }
    if (location < 0) continue;
    taken.push([location, location + name.length]);
    relinked.push({ ...part.mention, location });
  }
  return relinked.length > 0 ? relinked.sort((a, b) => a.location - b.location) : null;
}
