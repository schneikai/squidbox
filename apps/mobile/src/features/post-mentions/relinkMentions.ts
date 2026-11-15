import { type PostMention, POST_LIMITS } from '@squidbox/shared';

import type { MentionContact } from './mentionHandle';
import mentionParts, { type MentionTextValue } from './mentionParts';

/** A contact whose name in a text may become a mention: its id and name. */
export type MentionCandidate = Pick<MentionContact, 'id' | 'name'>;

// A letter or digit: a name that runs into one is part of a longer word ("Mark" in "Marking").
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * `text` (a text written over `value`: the assistant's Use, or an idea's Copy over no value) with its
 * mentions: first each valid chip of `value`, in its order, at the place its name stands as a whole
 * word that no earlier chip took, the one nearest where the chip stood (a chip whose name is gone is
 * dropped, its words, if any, plain text); then each contact of `mentioned` (the chat's Mentions of
 * the turn that wrote it), the longest name first, on every free place its full name stands as a
 * whole word, in its exact case (of two contacts with one name, the first in `mentioned`). An @ right
 * before a mention is dropped from the text ("@Sam Ridge" is Sam Ridge), and there are at most
 * POST_LIMITS.mentions. A first name alone, or a handle, stays plain text. The mentions are null when
 * none is left.
 */
export default function relinkMentions(
  value: MentionTextValue,
  text: string,
  mentioned: readonly MentionCandidate[] = [],
): MentionTextValue {
  const taken: [number, number][] = [];
  const placed: PostMention[] = [];
  const place = (mention: PostMention) => {
    taken.push([mention.location, mention.location + mention.name.length]);
    placed.push(mention);
  };

  for (const part of mentionParts(value.text, value.mentions)) {
    if (part.kind !== 'mention' || placed.length >= POST_LIMITS.mentions) continue;
    const { name, location: was } = part.mention;
    const best = freePlaces(text, name, taken).reduce<number | null>(
      (nearest, at) => (nearest === null || Math.abs(at - was) < Math.abs(nearest - was) ? at : nearest),
      null,
    );
    if (best !== null) place({ ...part.mention, location: best });
  }

  const longestFirst = [...mentioned].sort((a, b) => b.name.length - a.name.length);
  for (const { id, name } of longestFirst) {
    if (!name) continue;
    for (const at of freePlaces(text, name, taken)) {
      if (placed.length >= POST_LIMITS.mentions) break;
      // A place an earlier one of these took (a name that overlaps itself).
      if (isTaken(taken, at, at + name.length)) continue;
      place({ contactId: id, location: at, name });
    }
  }

  return withoutAts(
    text,
    placed.sort((a, b) => a.location - b.location),
  );
}

// Where `name` stands in `text` as a whole word, on no place `taken`.
function freePlaces(text: string, name: string, taken: readonly [number, number][]): number[] {
  const places: number[] = [];
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) {
    const end = at + name.length;
    const isWord = !WORD_CHARACTER.test(text[at - 1] ?? '') && !WORD_CHARACTER.test(text[end] ?? '');
    if (isWord && !isTaken(taken, at, end)) places.push(at);
  }
  return places;
}

function isTaken(taken: readonly [number, number][], start: number, end: number): boolean {
  return taken.some(([from, to]) => start < to && end > from);
}

// The text without the @ right before each mention (`sorted` by location), the mentions moved back to
// their names.
function withoutAts(text: string, sorted: PostMention[]): MentionTextValue {
  let result = '';
  let from = 0;
  const mentions = sorted.map((mention) => {
    const hasAt = text[mention.location - 1] === '@';
    const cut = hasAt ? mention.location - 1 : mention.location;
    result += text.slice(from, cut);
    const location = result.length;
    result += mention.name;
    from = mention.location + mention.name.length;
    return { ...mention, location };
  });
  result += text.slice(from);
  return { text: result, mentions: mentions.length > 0 ? mentions : null };
}
