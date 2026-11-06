import { type ContactPlace, placeParts } from '@squidbox/shared';

type PlacePart = keyof ContactPlace;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * `place` once its `part` was typed or picked, its empty parts filled from the `known` places (the
 * user's contacts'): a city that names exactly one known place fills its state and country, a state
 * that lies in exactly one known country fills the country: only from the specific to the general, so a
 * country fills nothing and a state never a city. A part already filled is never changed, and a city
 * or state known in two places fills nothing.
 */
export default function autofillPlace(
  place: ContactPlace,
  part: PlacePart,
  known: readonly (Partial<ContactPlace> | string)[],
): ContactPlace {
  const typed = place[part];
  if (!typed.trim() || part === 'country') return place;
  const matches = known.map(placeParts).filter((candidate) => same(candidate[part], typed));
  const fills: PlacePart[] = part === 'city' ? ['state', 'country'] : ['country'];
  const options = unique(matches.map((match) => fills.map((fill) => match[fill]).join('\n')));
  const [match] = matches;
  if (options.length !== 1 || !match) return place;

  const filled = { ...place };
  for (const fill of fills) if (!filled[fill].trim()) filled[fill] = match[fill];
  return filled;
}

// Each value once, ignoring case.
function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.toLowerCase()))];
}
