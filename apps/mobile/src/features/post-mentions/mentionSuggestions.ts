import contactAtHandles, { type AtHandleField } from '@/lib/contactAtHandles';
import { searchForms } from '@/sync/matchingIds';
import type { ContactSummary } from '@/sync/queries/contactQuery';

// The rows shown at most.
const MAX_SUGGESTIONS = 4;

export type MentionContact = Pick<ContactSummary, 'id' | 'name' | 'isFavorite' | 'avatarFilename'> &
  Partial<Pick<ContactSummary, AtHandleField>>;

// One handle of a contact to mention, with the networks it is theirs on ('X', 'Bluesky').
export type MentionSuggestion = { key: string; contact: MentionContact; handle: string; networks: string[] };

// A contact's handles to mention and the forms a query is matched against (searchForms), worked out
// once per read of the contacts rather than on every key typed.
export type MentionEntry = {
  contact: MentionContact;
  nameWords: string[];
  handles: { suggestion: MentionSuggestion; forms: string[] }[];
};

/** The contacts with a handle to mention, as mentionSuggestions matches them. */
export function mentionEntries(contacts: readonly MentionContact[]): MentionEntry[] {
  return contacts
    .map((contact) => ({
      contact,
      nameWords: searchForms(contact.name).flatMap((form) => form.split(/\s+/)),
      handles: handlesOf(contact).map((suggestion) => ({ suggestion, forms: searchForms(suggestion.handle) })),
    }))
    .filter((entry) => entry.handles.length > 0);
}

/**
 * The contacts' handles (`entries`, mentionEntries) that `query` (what follows the @, mentionAt) may
 * mean, best first, at most MAX_SUGGESTIONS: one per distinct handle of a contact (without case),
 * naming the networks it is on. The contacts on the post's photos (`onPhotoIds`) come first,
 * whichever way they match. Then a handle starting with the query, then one whose contact has a name
 * word starting with it, then one where either holds it anywhere, blind to case and accents as a
 * contact search is (searchForms); among those, favorites first, then by name. An empty query (just
 * the @) takes every handle. A handle in `taken` (lowercased, without the @) is left out.
 */
export default function mentionSuggestions(
  entries: readonly MentionEntry[],
  onPhotoIds: ReadonlySet<string>,
  query: string,
  taken: ReadonlySet<string> = new Set(),
): MentionSuggestion[] {
  const needles = searchForms(query);
  const ranked: { suggestion: MentionSuggestion; rank: number }[] = [];
  for (const { contact, nameWords, handles } of entries) {
    for (const { suggestion, forms } of handles) {
      if (taken.has(suggestion.handle.toLowerCase())) continue;
      const rank = matchRank(forms, nameWords, needles);
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

// A contact's @handles (contactAtHandles) as suggestions.
function handlesOf(contact: MentionContact): MentionSuggestion[] {
  return contactAtHandles(contact).map(({ handle, networks }) => ({
    key: `${contact.id}:${handle.toLowerCase()}`,
    contact,
    handle,
    networks,
  }));
}

// How well the query's forms (`needles`) match a handle's forms and its contact's name words (0
// best, 2 worst), or null when they don't.
function matchRank(handleForms: string[], nameWords: string[], needles: string[]): number | null {
  const some = (forms: string[], test: (form: string, needle: string) => boolean) =>
    forms.some((form) => needles.some((needle) => test(form, needle)));
  if (some(handleForms, (form, needle) => form.startsWith(needle))) return 0;
  if (some(nameWords, (word, needle) => word.startsWith(needle))) return 1;
  if (some([...handleForms, ...nameWords], (form, needle) => form.includes(needle))) return 2;
  return null;
}
