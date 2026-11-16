import { type ContactHandleField, type PostMention, POST_LIMITS, contactsByHandle } from '@squidbox/shared';

// A handle after its @: letters, digits and _, with dots or hyphens inside (`name`, `name.bsky.social`).
const HANDLE_BODY = String.raw`\w+(?:[.-]\w+)*`;

// An @handle at the start of a word: not right after a letter, a digit or an @ (an email address), nor
// after a character of a URL's path or query (`tiktok.com/@sam`, `?u=@sam`); and not running on into
// a letter a handle can't have (`@josé` is no `@jos`: every network's handle is ASCII). Group 1 is
// what comes before it.
const HANDLE = new RegExp(String.raw`(^|[^\p{L}\p{N}_@/.:=?&#%+~-])(@${HANDLE_BODY})(?![\p{L}\p{N}])`, 'gu');

export type HandleContact = { id: string; name: string } & Partial<Record<ContactHandleField, string | null>>;
type Value = { text: string; mentions: PostMention[] | null };

/** Why a typed @handle stayed text. */
export type LeftAsText = {
  handle: string;
  reason: 'no contact' | 'several contacts' | 'contact has no name' | 'too many mentions';
  names?: string[];
};

/**
 * A post's text with each typed @handle that means exactly one contact (contactsByHandle) as that
 * contact's mention: the @handle becomes the contact's name, and the mentions after it move with the
 * text. A handle that means no contact, or several, stays text (`left` says why); so does one past
 * POST_LIMITS.mentions, and one inside a URL or an email address is no handle at all. A mention
 * whose name no longer stands at its location is dropped, as the app reads it. `linked` is null
 * when nothing links.
 */
export function linkTypedHandles(
  value: Value,
  contacts: readonly HandleContact[],
): { linked: { text: string; mentions: PostMention[] } | null; left: LeftAsText[] } {
  const ofHandle = contactsByHandle(contacts);
  const chips = (value.mentions ?? []).filter((chip) => chip.name && value.text.startsWith(chip.name, chip.location));
  const isOnChip = (at: number, end: number) =>
    chips.some((chip) => at < chip.location + chip.name.length && end > chip.location);
  const typed = [...value.text.matchAll(HANDLE)]
    .map((match) => ({ handle: match[2]!, at: match.index + match[1]!.length }))
    .filter(({ handle, at }) => !isOnChip(at, at + handle.length));

  const left: LeftAsText[] = [];
  const links: { at: number; handle: string; contact: HandleContact }[] = [];
  const room = Math.max(0, POST_LIMITS.mentions - chips.length);
  for (const { handle, at } of typed) {
    const found = ofHandle(handle);
    if (found.length === 0) left.push({ handle, reason: 'no contact' });
    else if (found.length > 1) left.push({ handle, reason: 'several contacts', names: found.map(({ name }) => name) });
    else if (!found[0]!.name.trim()) left.push({ handle, reason: 'contact has no name' });
    else if (links.length >= room) left.push({ handle, reason: 'too many mentions' });
    else links.push({ at, handle, contact: found[0]! });
  }
  if (links.length === 0) return { linked: null, left };

  let text = '';
  let from = 0;
  const added: PostMention[] = [];
  for (const { at, handle, contact } of links) {
    text += value.text.slice(from, at);
    added.push({ contactId: contact.id, location: text.length, name: contact.name });
    text += contact.name;
    from = at + handle.length;
  }
  text += value.text.slice(from);
  // Where a place of the old text is in the new one: moved by what the links before it changed.
  const moved = (location: number) =>
    links
      .filter(({ at }) => at < location)
      .reduce((shift, { handle, contact }) => shift + contact.name.length - handle.length, location);
  const mentions = [...chips.map((chip) => ({ ...chip, location: moved(chip.location) })), ...added].sort(
    (a, b) => a.location - b.location,
  );
  return { linked: { text, mentions }, left };
}
