import type { ContactPlace } from '@squidbox/shared';

import samePlaceText from './samePlaceText';

type PlacePart = keyof ContactPlace;

/**
 * The different places among `places` by their `parts` (the parts that can tell them apart: a city's
 * state and country), each once, in the order first met. A place that only lacks parts of another and
 * agrees on the rest is that place ("São Paulo, Brazil" beside "São Paulo, São Paulo, Brazil"), so
 * only the fuller one is kept; "Portland, Oregon" and "Portland, Maine" stay two.
 */
export default function distinctPlaces(places: readonly ContactPlace[], parts: readonly PlacePart[]): ContactPlace[] {
  const fullest = places.filter(
    (place) =>
      !places.some(
        (other) => parts.some((part) => other[part].trim() && !place[part].trim()) && covers(other, place, parts),
      ),
  );
  return fullest.filter(
    (place, index) =>
      fullest.findIndex((other) => parts.every((part) => samePlaceText(other[part], place[part]))) === index,
  );
}

// Whether `fuller` has every part `place` has (of `parts`), the same.
function covers(fuller: ContactPlace, place: ContactPlace, parts: readonly PlacePart[]): boolean {
  return parts.every((part) => !place[part].trim() || samePlaceText(fuller[part], place[part]));
}
