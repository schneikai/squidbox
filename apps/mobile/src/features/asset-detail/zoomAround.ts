/**
 * One axis of a zoom: the translation that moves the content point under `from` to `to` while the
 * scale changes by `ratio`. Positions are measured from the view's center, its transform origin.
 * With `from` equal to `to` the point stays put (a pinch); a moving `to` follows the fingers.
 */
export default function zoomAround({
  translation,
  from,
  to,
  ratio,
}: {
  translation: number;
  from: number;
  to: number;
  ratio: number;
}): number {
  'worklet';
  return to - ratio * (from - translation);
}
