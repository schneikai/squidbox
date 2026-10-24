/**
 * Moves the pager by a finger's horizontal change `delta` (points, positive = moving right) while a
 * zoomed photo hands its swipe over at its edge. `shift` is the pager's offset from the current
 * page's origin, positive towards the next page, so the finger's change applies as `-delta`.
 * The shift never crosses 0 (dragging back hands the movement to the image again) and stops at a
 * page width, or at 0 on a side without a neighbour. What it can't take comes back as `leftover`,
 * in the finger's units, for the image to pan or rubber-band with.
 */
export default function shiftPager({ shift, delta, pageWidth, hasPrevious, hasNext }) {
  'worklet';
  const target = shift - delta;
  // Back past the current page's origin: the pager stops there and the image takes the rest.
  const isCrossing = (shift > 0 && target < 0) || (shift < 0 && target > 0);
  const min = hasPrevious ? -pageWidth : 0;
  const max = hasNext ? pageWidth : 0;
  const next = isCrossing ? 0 : Math.min(Math.max(target, min), max);
  return { shift: next, leftover: next - target };
}
