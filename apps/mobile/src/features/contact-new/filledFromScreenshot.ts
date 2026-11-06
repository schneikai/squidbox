import { CONTACT_HANDLE_FIELDS, CONTACT_LIMITS, type ContactFromScreenshotResponse } from '@squidbox/shared';

import { type ContactDraft, handleText, storedPlace } from '@/features/contact-detail/contactFields';

/**
 * The draft fields a screenshot's reading fills, from what it read: only what it found, within the
 * contact's limits (a place it read joins first, unless the draft has it, and the last one goes past
 * CONTACT_LIMITS.places).
 */
export default function filledFromScreenshot(
  read: ContactFromScreenshotResponse,
  draft: ContactDraft,
): Partial<ContactDraft> {
  const fields: Partial<ContactDraft> = {};
  for (const field of CONTACT_HANDLE_FIELDS)
    if (read[field]) fields[field] = handleText(field, read[field].slice(0, CONTACT_LIMITS.handle));
  if (read.name) fields.name = read.name.slice(0, CONTACT_LIMITS.name);
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
