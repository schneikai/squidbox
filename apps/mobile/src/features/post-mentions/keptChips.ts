import { type PostMention, POST_LIMITS } from '@squidbox/shared';

import type { MentionTextValue } from './mentionParts';
import validMentions from './validMentions';

// A letter, digit or _: a name that runs into one is part of a longer word.
const WORD_CHARACTER = /[\p{L}\p{N}_]/u;
// Before a name: it is a handle's, a hashtag's or an address's ("@Maya", "#Maya", "hello@Maya.com").
const NOT_BEFORE = /[@#]/;
// After a name: a handle or an address goes on ("Maya.bsky.social", "sam-lee", "Maya@x.com").
const GOES_ON = /^(?:[._-][\p{L}\p{N}_]|@)/u;

/**
 * `next` (a text written over `previous`, the assistant's Use) with each of `previous`' chips it
 * lost kept: a chip whose contact `next` doesn't mention, where its name stands in `next` at exactly
 * one place as a whole word (not inside a longer word, after an @ or #, or in a handle or an address)
 * that no mention of `next` takes. Anything less sure drops the chip, its words plain text. At most
 * POST_LIMITS.mentions; mentions null when there is none.
 */
export default function keptChips(previous: MentionTextValue, next: MentionTextValue): MentionTextValue {
  const mentions = validMentions(next);
  const carried = new Set(mentions.map(({ contactId }) => contactId));
  for (const chip of validMentions(previous)) {
    if (carried.has(chip.contactId) || mentions.length >= POST_LIMITS.mentions) continue;
    const places = wholeNamePlaces(next.text, chip.name).filter((at) => !overlaps(mentions, at, chip.name.length));
    if (places.length !== 1) continue;
    mentions.push({ ...chip, location: places[0]! });
    carried.add(chip.contactId);
  }
  mentions.sort((a, b) => a.location - b.location);
  return { text: next.text, mentions: mentions.length > 0 ? mentions : null };
}

// Where `name` stands in `text` as a whole word.
function wholeNamePlaces(text: string, name: string): number[] {
  const places: number[] = [];
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) {
    const before = text[at - 1] ?? '';
    const after = text.slice(at + name.length, at + name.length + 2);
    if (WORD_CHARACTER.test(before) || NOT_BEFORE.test(before)) continue;
    if (WORD_CHARACTER.test(after[0] ?? '') || GOES_ON.test(after)) continue;
    places.push(at);
  }
  return places;
}

function overlaps(mentions: readonly PostMention[], at: number, length: number): boolean {
  return mentions.some(({ location, name }) => at < location + name.length && at + length > location);
}
