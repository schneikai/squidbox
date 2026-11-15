import type { PostMention } from '@squidbox/shared';

import mentionParts, { type MentionTextValue } from './mentionParts';

// A letter or digit: a name that runs into one is part of a longer word ("Mark" in "Marking").
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * The mentions of `value` that still stand in `text` (a text written over it, the assistant's Use):
 * each valid chip, in its order, at the place its name stands as a whole word that no earlier chip
 * took, the one nearest where the chip stood; a chip whose name is gone is dropped (its words, if
 * any, are plain text). Null when none is left.
 */
export default function relinkMentions(value: MentionTextValue, text: string): PostMention[] | null {
  const taken: [number, number][] = [];
  const relinked: PostMention[] = [];
  for (const part of mentionParts(value.text, value.mentions)) {
    if (part.kind !== 'mention') continue;
    const { name, location: was } = part.mention;
    let best = -1;
    for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) {
      const end = at + name.length;
      const isWord = !WORD_CHARACTER.test(text[at - 1] ?? '') && !WORD_CHARACTER.test(text[end] ?? '');
      const isFree = !taken.some(([start, stop]) => at < stop && end > start);
      if (isWord && isFree && (best < 0 || Math.abs(at - was) < Math.abs(best - was))) best = at;
    }
    if (best < 0) continue;
    taken.push([best, best + name.length]);
    relinked.push({ ...part.mention, location: best });
  }
  return relinked.length > 0 ? relinked.sort((a, b) => a.location - b.location) : null;
}
