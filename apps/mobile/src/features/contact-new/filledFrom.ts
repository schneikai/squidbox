import {
  CONTACT_HANDLE_BY_FIELD,
  CONTACT_HANDLE_FIELDS,
  CONTACT_LIMITS,
  type ContactHandleField,
  type ContactRead,
  handleKey,
  parseHandle,
} from '@squidbox/shared';

import { type ContactDraft, storedPlace } from '@/features/contact-detail/contactFields';

// A handle read as the app writes it into its field: a single `@` where the network writes one (X,
// Bluesky), a link as it is, nothing for only `@`s.
function handleText(field: ContactHandleField, text: string): string {
  const parsed = parseHandle(text, field);
  if (parsed.kind === 'empty') return '';
  if (parsed.kind === 'link') return text.trim();
  return CONTACT_HANDLE_BY_FIELD[field].isAtHandle ? `@${parsed.handle}` : parsed.handle;
}

/**
 * The draft fields a reading of a profile fills (From screenshot's or From link's), from what it
 * read: only what it found and the draft doesn't hold yet, within the contact's limits. A handle the
 * draft already has under any spelling (handleKey), or its name, isn't filled, so Undo leaves it; a place
 * it read joins first, unless the draft has it, and the last one goes past CONTACT_LIMITS.places. The
 * notes are the user's: a profile's bio and website never fill them.
 */
export default function filledFrom(read: ContactRead, draft: ContactDraft): Partial<ContactDraft> {
  const fields: Partial<ContactDraft> = {};
  for (const field of CONTACT_HANDLE_FIELDS) {
    // Written as its field writes it (handleText), then cut, so the `@` never takes it past the limit.
    const handle = handleText(field, read[field]).slice(0, CONTACT_LIMITS.handle);
    if (handle && handleKey(draft[field], field) !== handleKey(read[field], field)) fields[field] = handle;
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
