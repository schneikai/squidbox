import { CONTACT_HANDLE_FIELDS, type Channel } from '@squidbox/shared';

import mentionChannels from './mentionChannels';
import mentionHandle, { type MentionContact } from './mentionHandle';

import { searchForms } from '@/sync/matchingIds';
import joinWords from '@/utils/joinWords';

// The rows shown at most.
const MAX_SUGGESTIONS = 4;

/** A contact to mention: one row, with its handles in one line ("@sam on X and Bluesky", or "No handles"). */
export type MentionSuggestion = { contact: MentionContact; handlesText: string };

// A contact and the forms a query is matched against (searchForms), worked out once per read of the
// contacts rather than on every key typed.
export type MentionEntry = {
  suggestion: MentionSuggestion;
  nameForms: string[];
  nameWords: string[];
  handleForms: string[];
};

/**
 * The contacts as mentionSuggestions matches them, every one, with or without a handle: by any of
 * their handles, each row showing those on the user's `channels` (mentionChannels).
 */
export function mentionEntries(contacts: readonly MentionContact[], channels: readonly Channel[]): MentionEntry[] {
  const shownChannels = mentionChannels(channels);
  return contacts.map((contact) => {
    const nameForms = searchForms(contact.name);
    return {
      suggestion: { contact, handlesText: handlesText(handlesOf(contact, shownChannels)) },
      nameForms,
      nameWords: nameForms.flatMap((form) => form.split(/\s+/)),
      handleForms: CONTACT_HANDLE_FIELDS.flatMap((field) => mentionHandle(contact, field) ?? []).flatMap(searchForms),
    };
  });
}

/**
 * The contacts (`entries`, mentionEntries) that `query` (what follows the @, mentionAt; a name may
 * have spaces) may mean, best first, at most MAX_SUGGESTIONS, one row per contact. The contacts on
 * the post's photos (`onPhotoIds`) come first, whichever way they match. Then a name (or a word of
 * it) starting with the query, then a handle starting with it, then either holding it anywhere,
 * blind to case and accents as a contact search is (searchForms); among those, favorites first, then
 * by name. An empty query (just the @) takes every contact.
 */
export default function mentionSuggestions(
  entries: readonly MentionEntry[],
  onPhotoIds: ReadonlySet<string>,
  query: string,
): MentionSuggestion[] {
  const needles = searchForms(query.trim());
  const ranked: { suggestion: MentionSuggestion; rank: number }[] = [];
  for (const entry of entries) {
    const rank = matchRank(entry, needles);
    // Past every rank of a contact that isn't on the photos.
    if (rank != null)
      ranked.push({ suggestion: entry.suggestion, rank: rank + (onPhotoIds.has(entry.suggestion.contact.id) ? 0 : 3) });
  }
  return ranked
    .sort((a, b) => {
      const [x, y] = [a.suggestion.contact, b.suggestion.contact];
      return (
        a.rank - b.rank ||
        Number(y.isFavorite ?? false) - Number(x.isFavorite ?? false) ||
        x.name.localeCompare(y.name, undefined, { sensitivity: 'base' })
      );
    })
    .slice(0, MAX_SUGGESTIONS)
    .map(({ suggestion }) => suggestion);
}

// A contact's distinct handles (mentionHandle) on `channels`, each with the channels it is on, in their order.
function handlesOf(contact: MentionContact, channels: readonly Channel[]): { handle: string; networks: string[] }[] {
  const byKey = new Map<string, { handle: string; networks: string[] }>();
  for (const { handleField, name: label } of channels) {
    const handle = mentionHandle(contact, handleField);
    if (!handle) continue;
    const key = handle.toLowerCase();
    const seen = byKey.get(key);
    if (seen) seen.networks.push(label);
    else byKey.set(key, { handle, networks: [label] });
  }
  return [...byKey.values()];
}

function handlesText(handles: { handle: string; networks: string[] }[]): string {
  if (handles.length === 0) return 'No handles';
  return handles.map(({ handle, networks }) => `@${handle} on ${joinWords(networks)}`).join(' · ');
}

// How well the query's forms (`needles`) match a contact (0 best, 2 worst), or null when they don't.
function matchRank({ nameForms, nameWords, handleForms }: MentionEntry, needles: string[]): number | null {
  const some = (forms: string[], test: (form: string, needle: string) => boolean) =>
    forms.some((form) => needles.some((needle) => test(form, needle)));
  const starts = (form: string, needle: string) => form.startsWith(needle);
  if (some(nameForms, starts) || some(nameWords, starts)) return 0;
  if (some(handleForms, starts)) return 1;
  if (some([...nameForms, ...handleForms], (form, needle) => form.includes(needle))) return 2;
  return null;
}
