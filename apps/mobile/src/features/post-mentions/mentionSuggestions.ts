import { CONTACT_HANDLES } from '@squidbox/shared';

import type { ContactSummary } from '@/features/contact-list/contactQuery';
import { searchForms } from '@/sync/matchingIds';

// The networks whose handles are written with @ in a post's text, in the order the app shows them.
const MENTION_HANDLES = CONTACT_HANDLES.filter((handle) => handle.isAtHandle);
type MentionHandleField = (typeof MENTION_HANDLES)[number]['field'];

// The rows shown at most.
const MAX_SUGGESTIONS = 4;

export type MentionContact = Pick<ContactSummary, 'id' | 'name' | 'isFavorite' | 'avatarFilename'> &
  Partial<Pick<ContactSummary, MentionHandleField>>;

// One handle of a contact to mention, with the networks it is theirs on ('X', 'Bluesky').
export type MentionSuggestion = { key: string; contact: MentionContact; handle: string; networks: string[] };

/**
 * The contacts' handles that `query` (what follows the @, mentionAt) may mean, best first, at most
 * MAX_SUGGESTIONS: one per distinct handle of a contact (without case), naming the networks it is on.
 * The contacts on the post's photos (`onPhotoIds`) come first, whichever way they match. Then a
 * handle starting with the query, then one whose contact has a name word starting with it, then one
 * where either holds it anywhere, blind to case and accents as a contact search is (searchForms);
 * among those, favorites first, then by name. An empty query (just the @) takes every handle.
 */
export default function mentionSuggestions(
  contacts: readonly MentionContact[],
  onPhotoIds: ReadonlySet<string>,
  query: string,
): MentionSuggestion[] {
  const needles = searchForms(query);
  const ranked: { suggestion: MentionSuggestion; rank: number }[] = [];
  for (const contact of contacts) {
    for (const suggestion of handlesOf(contact)) {
      const rank = matchRank(suggestion.handle, contact.name, needles);
      // Past every rank of a contact that isn't on the photos.
      if (rank != null) ranked.push({ suggestion, rank: rank + (onPhotoIds.has(contact.id) ? 0 : 3) });
    }
  }
  return ranked
    .sort((a, b) => {
      const [x, y] = [a.suggestion.contact, b.suggestion.contact];
      return (
        a.rank - b.rank ||
        Number(y.isFavorite) - Number(x.isFavorite) ||
        x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }) ||
        a.suggestion.handle.localeCompare(b.suggestion.handle)
      );
    })
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

// How well the query's forms (`needles`) match (0 best, 2 worst), or null when they don't.
function matchRank(handle: string, name: string, needles: string[]): number | null {
  const handleForms = searchForms(handle);
  const nameForms = searchForms(name);
  const matches = (forms: string[], test: (form: string, needle: string) => boolean) =>
    forms.some((form) => needles.some((needle) => test(form, needle)));
  if (matches(handleForms, (form, needle) => form.startsWith(needle))) return 0;
  if (matches(nameForms, (form, needle) => form.split(/\s+/).some((word) => word.startsWith(needle)))) return 1;
  if (matches([...handleForms, ...nameForms], (form, needle) => form.includes(needle))) return 2;
  return null;
}
