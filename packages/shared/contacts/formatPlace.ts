import type { ContactPlace } from '../collections/contact';

// The names a place's country goes by in the United States, where the state is said too.
const US_NAMES = new Set(['united states', 'united states of america', 'usa', 'us']);

/**
 * A stored place as `{ city, state, country }`, each a string: a part it lacks is ''. A place stored
 * as one string before places had parts (an unreleased build's) is read by its commas: "City",
 * "City, Country" or "City, State, Country" (anything between the first and the last part is the state).
 */
export function placeParts(place: Partial<ContactPlace> | string | null | undefined): ContactPlace {
  if (typeof place === 'string') return partsOfText(place);
  return { city: place?.city ?? '', state: place?.state ?? '', country: place?.country ?? '' };
}

/**
 * A place as one line: "City, Country", with the state between them in the United States
 * ("Denver, Colorado, United States"), and whatever parts it has when some are missing.
 */
export function formatPlace(stored: Partial<ContactPlace> | string): string {
  const place = placeParts(stored);
  const isUs = US_NAMES.has(place.country.trim().toLowerCase());
  const parts = isUs || !place.city ? [place.city, place.state, place.country] : [place.city, place.country];
  return parts.filter(Boolean).join(', ');
}

function partsOfText(text: string): ContactPlace {
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return { city: parts[0] ?? '', state: '', country: '' };
  return { city: parts[0]!, state: parts.slice(1, -1).join(', '), country: parts[parts.length - 1]! };
}
