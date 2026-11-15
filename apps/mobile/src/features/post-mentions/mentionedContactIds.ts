import type { MentionContact } from './mentionHandle';
import mentionParts, { type MentionTextValue } from './mentionParts';

import extractHandles from '@/lib/extractHandles';

/**
 * The contacts a post mentions, each once: each valid chip's contact that is still live
 * (`contactsById`), then every contact each typed @handle means (`ofHandle`, contactsByHandle; a
 * handle several contacts have means each of them).
 */
export default function mentionedContactIds(
  value: MentionTextValue,
  contactsById: ReadonlyMap<string, MentionContact>,
  ofHandle: (handle: string) => readonly MentionContact[],
): string[] {
  const chips = mentionParts(value.text, value.mentions).flatMap((part) =>
    part.kind === 'mention' && contactsById.has(part.mention.contactId) ? [part.mention.contactId] : [],
  );
  const typed = extractHandles([value.text]).flatMap((handle) => ofHandle(handle).map((contact) => contact.id));
  return [...new Set([...chips, ...typed])];
}
