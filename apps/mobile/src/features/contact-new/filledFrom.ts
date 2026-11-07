import { CONTACT_HANDLE_FIELDS, CONTACT_LIMITS, type ContactRead, normalizeHandle } from '@squidbox/shared';

import { type ContactDraft, handleText, storedPlace } from '@/features/contact-detail/contactFields';

/**
 * The draft fields a reading of a profile fills (From screenshot's or From link's), from what it
 * read: only what it found and the draft doesn't hold yet, within the contact's limits. A handle or
 * name the draft already has (as typed, `@` and case aside) isn't filled, so Undo leaves it; a place
 * it read joins first, unless the draft has it, and the last one goes past CONTACT_LIMITS.places. The
 * notes are the user's: a profile's bio and website never fill them.
 */
export default function filledFrom(read: ContactRead, draft: ContactDraft): Partial<ContactDraft> {
  const fields: Partial<ContactDraft> = {};
  for (const field of CONTACT_HANDLE_FIELDS) {
    const handle = read[field].slice(0, CONTACT_LIMITS.handle);
    if (handle && normalizeHandle(draft[field]) !== normalizeHandle(handle)) fields[field] = handleText(field, handle);
  }
  const name = read.name.trim().slice(0, CONTACT_LIMITS.name);
  if (name && draft.name.trim() !== name) fields.name = name;
  const part = (text: string | undefined) => (text ?? '').slice(0, CONTACT_LIMITS.place);
  const place = storedPlace({ city: part(read.city), state: part(read.state), country: part(read.country) });
  // The draft's places that hold something, each with its stored form to compare.
  const draftPlaces = draft.places.flatMap((typed) => {
    const stored = storedPlace(typed);
    return stored ? [{ typed, stored: JSON.stringify(stored) }] : [];
  });
  const isKnown = draftPlaces.some(({ stored }) => stored === JSON.stringify(place));
  if (place && !isKnown)
    fields.places = [place, ...draftPlaces.map(({ typed }) => typed)].slice(0, CONTACT_LIMITS.places);
  return fields;
}
