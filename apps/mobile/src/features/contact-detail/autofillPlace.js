import { placeParts } from '@squidbox/shared';

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * `place` once its `part` was typed or picked, its empty parts filled from the `known` places (the
 * user's contacts'): a city that names exactly one known place fills its state and country, a state
 * that lies in exactly one known country fills the country: only from the specific to the general, so a
 * country fills nothing and a state never a city. A part already filled is never changed, and a city
 * or state known in two places fills nothing.
 */
export default function autofillPlace(place, part, known) {
  const typed = place[part];
  if (!typed.trim() || part === 'country') return place;
  const matches = known.map(placeParts).filter((candidate) => same(candidate[part], typed));
  const fills = part === 'city' ? ['state', 'country'] : ['country'];
  const options = unique(matches.map((match) => fills.map((fill) => match[fill]).join('\n')));
  if (options.length !== 1) return place;

  const [match] = matches;
  return Object.fromEntries(
    Object.entries(place).map(([key, value]) => [key, fills.includes(key) && !value.trim() ? match[key] : value]),
  );
}

// Each value once, ignoring case.
function unique(values) {
  return [...new Set(values.map((value) => value.toLowerCase()))];
}
