import type { MentionContact } from './mentionHandle';
import type { MentionTextValue } from './mentionParts';
import typedHandles from './typedHandles';
import validMentions from './validMentions';

/**
 * The contacts a post mentions, each once: each valid chip's contact that is still live
 * (`contactsById`), then, given `ofHandle` (contactsByHandle; Tag photos from mentions), every
 * contact each typed @handle means (a handle several contacts have means each of them).
 */
export default function mentionedContactIds(
  value: MentionTextValue,
  contactsById: ReadonlyMap<string, MentionContact>,
  ofHandle?: (handle: string) => readonly MentionContact[],
): string[] {
  const chips = validMentions(value)
    .map((mention) => mention.contactId)
    .filter((id) => contactsById.has(id));
  const typed = ofHandle
    ? typedHandles(value.text).flatMap((handle) => ofHandle(handle).map((contact) => contact.id))
    : [];
  return [...new Set([...chips, ...typed])];
}
