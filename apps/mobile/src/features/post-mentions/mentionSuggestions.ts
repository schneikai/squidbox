import { CONTACT_HANDLES, type ContactRecord } from '@squidbox/shared';

// The networks whose handles are written with @ in a post's text, in the order the app shows them.
export const MENTION_HANDLES = CONTACT_HANDLES.filter((handle) => handle.isAtHandle);
export type MentionHandleField = (typeof MENTION_HANDLES)[number]['field'];

// The rows shown at most.
const MAX_SUGGESTIONS = 4;

// `isOnPhotos`: the contact is on one of the post's photos.
export type MentionContact = Pick<ContactRecord, 'id' | 'name' | 'isFavorite' | 'avatarFilename'> &
  Partial<Record<MentionHandleField, string | null>> & { isOnPhotos?: boolean };

// One handle of a contact to mention, with the networks it is theirs on ('X', 'Bluesky').
export type MentionSuggestion = { key: string; contact: MentionContact; handle: string; networks: string[] };

/**
 * The contacts' handles that `query` (what follows the @, mentionAt) may mean, best first, at most
 * MAX_SUGGESTIONS: one per distinct handle of a contact (without case), naming the networks it is on.
 * The contacts on the post's photos (`isOnPhotos`) come first, whichever way they match. Then a
 * handle starting with the query comes first, then one whose contact has a name word starting with
 * it, then one where either holds it anywhere, all without case; among those, favorites first, then by
 * name. An empty query (just the @) takes every handle.
 */
export default function mentionSuggestions(contacts: readonly MentionContact[], query: string): MentionSuggestion[] {
  const q = query.toLowerCase();
  const ranked: { suggestion: MentionSuggestion; rank: number }[] = [];
  for (const contact of contacts) {
    for (const suggestion of handlesOf(contact)) {
      const rank = matchRank(suggestion.handle.toLowerCase(), contact.name.toLowerCase(), q);
      if (rank != null) ranked.push({ suggestion, rank });
    }
  }
  return ranked
    .sort(
      (a, b) =>
        Number(Boolean(b.suggestion.contact.isOnPhotos)) - Number(Boolean(a.suggestion.contact.isOnPhotos)) ||
        a.rank - b.rank ||
        Number(b.suggestion.contact.isFavorite) - Number(a.suggestion.contact.isFavorite) ||
        a.suggestion.contact.name.localeCompare(b.suggestion.contact.name, undefined, { sensitivity: 'base' }) ||
        a.suggestion.handle.localeCompare(b.suggestion.handle),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(({ suggestion }) => suggestion);
}

// A contact's distinct @handles, each with the networks it is on, in the app's order.
function handlesOf(contact: MentionContact): MentionSuggestion[] {
  const byKey = new Map<string, MentionSuggestion>();
  for (const { field, label } of MENTION_HANDLES) {
    const handle = contact[field];
    if (!handle) continue;
    const key = handle.toLowerCase();
    const seen = byKey.get(key);
    if (seen) seen.networks.push(label);
    else byKey.set(key, { key: `${contact.id}:${key}`, contact, handle, networks: [label] });
  }
  return [...byKey.values()];
}

// How well `query` matches (lower is better), or null when it doesn't.
function matchRank(handle: string, name: string, query: string): number | null {
  if (handle.startsWith(query)) return 0;
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return 1;
  if (handle.includes(query) || name.includes(query)) return 2;
  return null;
}
