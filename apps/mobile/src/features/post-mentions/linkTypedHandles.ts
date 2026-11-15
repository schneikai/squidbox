import { type PostMention, POST_LIMITS } from '@squidbox/shared';

import type { MentionContact } from './mentionHandle';
import mentionParts, { type MentionTextValue } from './mentionParts';

import handlesIn from '@/lib/handlesIn';

/**
 * `value` (a saved post's text, as it opens in an editor) with each @handle typed in its plain text
 * (handlesIn) that means exactly one contact (`ofHandle`, contactsByHandle) as that contact's
 * mention: the @handle becomes the contact's name, and the mentions after it move with the text. A
 * handle that means no contact, or several, stays text; so does one past POST_LIMITS.mentions. The
 * same value back when nothing links.
 */
export default function linkTypedHandles<T extends MentionTextValue>(
  value: T,
  ofHandle: (handle: string) => readonly MentionContact[],
): T {
  const chips = mentionParts(value.text, value.mentions).flatMap((part) =>
    part.kind === 'mention' ? [part.mention] : [],
  );
  const isOnChip = (at: number, end: number) =>
    chips.some((chip) => at < chip.location + chip.name.length && end > chip.location);
  const links = handlesIn(value.text).flatMap(({ handle, at }) => {
    const contacts = ofHandle(handle);
    const contact = contacts.length === 1 ? contacts[0]! : null;
    return contact?.name && !isOnChip(at, at + handle.length) ? [{ at, handle, contact }] : [];
  });
  const room = Math.max(0, POST_LIMITS.mentions - chips.length);
  if (links.length === 0 || room === 0) return value;

  let text = '';
  let from = 0;
  const linked: PostMention[] = [];
  for (const { at, handle, contact } of links.slice(0, room)) {
    text += value.text.slice(from, at);
    linked.push({ contactId: contact.id, location: text.length, name: contact.name });
    text += contact.name;
    from = at + handle.length;
  }
  text += value.text.slice(from);
  // Where each place of the old text is in the new one: moved by what the links before it changed.
  const moved = (location: number) =>
    links
      .slice(0, room)
      .filter(({ at }) => at < location)
      .reduce((shift, { handle, contact }) => shift + contact.name.length - handle.length, location);
  const mentions = [...chips.map((chip) => ({ ...chip, location: moved(chip.location) })), ...linked].sort(
    (a, b) => a.location - b.location,
  );
  return { ...value, text, mentions };
}
