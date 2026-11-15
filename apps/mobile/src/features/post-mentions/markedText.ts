import { mentionMarkers, type PostMention, POST_LIMITS } from '@squidbox/shared';

import type { MentionContact } from './mentionHandle';
import type { MentionTextValue } from './mentionParts';
import validMentions from './validMentions';

/**
 * A contact a turn's mention markers may name: its id and name, and `isInDraft` when a chip of the
 * draft's own posts mentions it (the user already chose that contact for the name).
 */
export type MentionCandidate = Pick<MentionContact, 'id' | 'name'> & { isInDraft?: boolean };

/**
 * `text` as the assistant wrote it, with its mention markers (mentionMarkers) made mentions of the
 * contacts of `mentioned`. A name means the contact the draft's own chips give it, when they all give
 * one; else the one contact of the Mentions with that name; else (two contacts, or draft chips of two)
 * nobody, and its marker stays plain text, as one naming nobody given or a broken one does. At most
 * POST_LIMITS.mentions; mentions null when there is none.
 */
function read(text: string, mentioned: readonly MentionCandidate[]): MentionTextValue {
  const byKey = new Map<string, MentionCandidate[]>();
  for (const contact of mentioned) {
    const key = mentionMarkers.key(contact.name);
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), contact]);
  }
  const chosen = new Map<string, MentionCandidate>();
  for (const [key, contacts] of byKey) {
    const inDraft = contacts.filter((contact) => contact.isInDraft);
    const meant = inDraft.length > 0 ? inDraft : contacts;
    if (new Set(meant.map(({ id }) => id)).size === 1) chosen.set(key, meant[0]!);
  }
  const { text: plain, marks } = mentionMarkers.read(
    text,
    [...chosen.values()].map(({ name }) => name),
  );
  const mentions: PostMention[] = marks
    .slice(0, POST_LIMITS.mentions)
    .map(({ location, name }) => ({ contactId: chosen.get(mentionMarkers.key(name))!.id, location, name }));
  return { text: plain, mentions: mentions.length > 0 ? mentions : null };
}

/** `value` as the assistant is sent it: its valid mentions (validMentions) as markers, the inverse of `read`. */
function write(value: MentionTextValue): string {
  return mentionMarkers.write(value.text, validMentions(value));
}

/** A text with mentions and the assistant's marked text, one into the other. */
const markedText = { read, write };

export default markedText;
