import { mentionMarkers, type PostMention, POST_LIMITS } from '@squidbox/shared';

import type { MentionContact } from './mentionHandle';
import mentionParts, { type MentionTextValue } from './mentionParts';

/** A contact a turn's mention markers may name: its id and name. */
export type MentionCandidate = Pick<MentionContact, 'id' | 'name'>;

/**
 * How texts the assistant wrote for one turn are read: each its mention markers (mentionMarkers) made
 * mentions of the contacts of `mentioned`. A name means the one contact of `mentioned` with that name
 * (mentionMarkers.key); a name two contacts share means nobody, and its marker stays plain text, as
 * one naming nobody given or a broken one does. At most POST_LIMITS.mentions; mentions null when there
 * is none.
 */
function reader(mentioned: readonly MentionCandidate[]): (text: string) => MentionTextValue {
  // By name: its one contact, or null when two contacts share it.
  const byKey = new Map<string, MentionCandidate | null>();
  for (const contact of mentioned) {
    const key = mentionMarkers.key(contact.name);
    if (!key) continue;
    const seen = byKey.get(key);
    byKey.set(key, seen === undefined || seen?.id === contact.id ? contact : null);
  }
  const names = new Map([...byKey].flatMap(([key, contact]) => (contact ? [[key, contact.name] as const] : [])));

  return (text) => {
    const { text: plain, marks } = mentionMarkers.read(text, names);
    const mentions: PostMention[] = marks
      .slice(0, POST_LIMITS.mentions)
      .map(({ location, name }) => ({ contactId: byKey.get(mentionMarkers.key(name))!.id, location, name }));
    return { text: plain, mentions: mentions.length > 0 ? mentions : null };
  };
}

/**
 * `value` as the assistant is sent it: each valid mention (mentionParts) as a marker, at most `limit`
 * characters long. A marker that wouldn't fit whole goes as its name, cut there.
 */
function write(value: MentionTextValue, limit = Infinity): string {
  let written = '';
  for (const part of mentionParts(value.text, value.mentions)) {
    const plain = part.kind === 'text' ? part.text : part.mention.name;
    const piece = part.kind === 'text' ? part.text : mentionMarkers.mark(part.mention.name);
    if (written.length + piece.length > limit) return written + plain.slice(0, limit - written.length);
    written += piece;
  }
  return written;
}

/** A text with mentions and the assistant's marked text, one into the other. */
const markedText = { reader, write };

export default markedText;
