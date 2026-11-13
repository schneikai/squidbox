/**
 * A contact's places with the one at `index` set to `place`: added at the end when `index` is null
 * (a new place), taken out when `place` is null.
 */
export default function placesWith<T>(places: readonly T[], index: number | null, place: T | null): T[] {
  if (place === null) return places.filter((_, i) => i !== index);
  if (index === null) return [...places, place];
  return places.map((p, i) => (i === index ? place : p));
}
