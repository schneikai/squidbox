import type { ContactPlace } from '../collections/contact';

// The names a place's country goes by in the United States, where the state is said too.
const US_NAMES = new Set(['united states', 'united states of america', 'usa', 'us']);

/**
 * A stored place as `{ city, state, country }`, each a string: a part it lacks is ''. A place stored
 * as one string before places had parts (an unreleased build's) reads as its city.
 */
export function placeParts(place: Partial<ContactPlace> | string | null | undefined): ContactPlace {
  if (typeof place === 'string') return { city: place, state: '', country: '' };
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
