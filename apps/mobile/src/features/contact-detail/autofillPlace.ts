import { type ContactPlace, placeParts } from '@squidbox/shared';

import distinctPlaces from './distinctPlaces';
import samePlaceText from './samePlaceText';

type PlacePart = keyof ContactPlace;

/**
 * `place` once its `part` was typed or picked, its empty parts filled from the `known` places (the
 * user's contacts'): a city that names exactly one known place fills its state and country, a state
 * that lies in exactly one known country fills the country: only from the specific to the general, so a
 * country fills nothing and a state never a city. A known place that only lacks parts of another
 * ("São Paulo, Brazil" beside "São Paulo, São Paulo, Brazil") is the same place, so the fuller one
 * fills. Known places in another country than the one filled don't count. A part already filled is
 * never changed, and a city or state known in two places fills nothing.
 */
export default function autofillPlace(
  place: ContactPlace,
  part: PlacePart,
  known: readonly (Partial<ContactPlace> | string)[],
): ContactPlace {
  const typed = place[part];
  if (!typed.trim() || part === 'country') return place;
  const fills: PlacePart[] = part === 'city' ? ['state', 'country'] : ['country'];
  // Only the known places in the country already filled, if one is: "Bogotá" with Colombia set never
  // takes a state from a Bogotá elsewhere. A state already filled doesn't narrow them, so a typed "BC"
  // still finds British Columbia's country.
  const country = place.country.trim();
  const matches = known
    .map(placeParts)
    .filter(
      (candidate) =>
        samePlaceText(candidate[part], typed) &&
        (!country || !candidate.country.trim() || samePlaceText(candidate.country, country)),
    );
  const [match, ...others] = distinctPlaces(matches, fills);
  if (!match || others.length > 0) return place;

  const filled = { ...place };
  for (const fill of fills) if (!filled[fill].trim()) filled[fill] = match[fill];
  return filled;
}
