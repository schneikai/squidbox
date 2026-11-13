import {
  CONTACT_HANDLE_BY_FIELD,
  CONTACT_HANDLE_FIELDS,
  CONTACT_LIMITS,
  type ContactHandleField,
  type ContactPlace,
  type ContactRead,
  handleKey,
  parseHandle,
} from '@squidbox/shared';

import autofillPlace from '@/features/contact-detail/autofillPlace';
import type { ContactDraft } from '@/features/contact-detail/contactFields';
import mostUsed from '@/features/contact-detail/mostUsed';
import samePlaceText from '@/features/contact-detail/samePlaceText';
import storedPlace from '@/utils/contacts/storedPlace';

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
 * it read joins first, unless the draft has it, and the last one goes past CONTACT_LIMITS.places. A
 * place is completed from the `known` places (the user's contacts') as a typed one is (autofillPlace):
 * a reading leaves out a state outside the US, so "São Paulo, Brazil" becomes "São Paulo, São Paulo,
 * Brazil" when that is the place the contacts know, and each part read takes the spelling the
 * contacts use for it ("sao paulo" is saved as "São Paulo"). The notes are the user's: a profile's bio and
 * website never fill them.
 */
export default function filledFrom(
  read: ContactRead,
  draft: ContactDraft,
  known: readonly ContactPlace[] = [],
): Partial<ContactDraft> {
  const fields: Partial<ContactDraft> = {};
  for (const field of CONTACT_HANDLE_FIELDS) {
    // Written as its field writes it (handleText), then cut, so the `@` never takes it past the limit.
    const handle = handleText(field, read[field]).slice(0, CONTACT_LIMITS.handle);
    if (handle && handleKey(draft[field], field) !== handleKey(read[field], field)) fields[field] = handle;
  }
  const name = read.name.trim().slice(0, CONTACT_LIMITS.name);
  if (name && draft.name.trim() !== name) fields.name = name;
  const part = (text: string | undefined) => (text ?? '').slice(0, CONTACT_LIMITS.place);
  const readPlace = { city: part(read.city), state: part(read.state), country: part(read.country) };
  const spelled = knownSpelling(readPlace, known);
  const place = storedPlace(autofillPlace(autofillPlace(spelled, 'city', known), 'state', known));
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

// `place` with each part spelled as the `known` places spell it, where one matches it blind to case and
// accents (the most used spelling): the country and state among all of them, the city only among the
// places in its country, so "San Jose, United States" never takes a "San José, Costa Rica" accent.
function knownSpelling(place: ContactPlace, known: readonly ContactPlace[]): ContactPlace {
  const spelled = (text: string, values: string[]) =>
    mostUsed(values).find((value) => samePlaceText(value, text)) ?? text;
  const country = spelled(
    place.country,
    known.map(({ country }) => country),
  );
  const sameCountry = known.filter(({ country: other }) => !country.trim() || samePlaceText(other, country));
  return {
    city: spelled(
      place.city,
      sameCountry.map(({ city }) => city),
    ),
    state: spelled(
      place.state,
      known.map(({ state }) => state),
    ),
    country,
  };
}
