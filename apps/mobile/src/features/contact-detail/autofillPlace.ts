import { type ContactPlace, placeParts } from '@squidbox/shared';

import { searchForms } from '@/sync/matchingIds';

type PlacePart = keyof ContactPlace;

// A part as it is compared: blind to case and accents, as a search is ("Sao Paulo" is "São Paulo").
const comparable = (text: string) => searchForms(text.trim())[0]!;
const same = (a: string, b: string) => comparable(a) === comparable(b);

/**
 * `place` once its `part` was typed or picked, its empty parts filled from the `known` places (the
 * user's contacts'): a city that names exactly one known place fills its state and country, a state
 * that lies in exactly one known country fills the country: only from the specific to the general, so a
 * country fills nothing and a state never a city. A known place that only lacks parts of another
 * ("São Paulo, Brazil" beside "São Paulo, São Paulo, Brazil") is the same place, so the fuller one
 * fills. A part already filled is never changed, and a city or state known in two places fills nothing.
 */
export default function autofillPlace(
  place: ContactPlace,
  part: PlacePart,
  known: readonly (Partial<ContactPlace> | string)[],
): ContactPlace {
  const typed = place[part];
  if (!typed.trim() || part === 'country') return place;
  const fills: PlacePart[] = part === 'city' ? ['state', 'country'] : ['country'];
  const matches = known.map(placeParts).filter((candidate) => same(candidate[part], typed));
  const fullest = matches.filter(
    (match) =>
      !matches.some(
        (other) => fills.some((fill) => other[fill].trim() && !match[fill].trim()) && covers(other, match, fills),
      ),
  );
  const [match] = fullest;
  if (!match || fullest.some((other) => !fills.every((fill) => same(other[fill], match[fill])))) return place;

  const filled = { ...place };
  for (const fill of fills) if (!filled[fill].trim()) filled[fill] = match[fill];
  return filled;
}

// Whether `fuller` has every part `place` has (of `parts`), the same.
function covers(fuller: ContactPlace, place: ContactPlace, parts: PlacePart[]): boolean {
  return parts.every((part) => !place[part].trim() || same(fuller[part], place[part]));
}
