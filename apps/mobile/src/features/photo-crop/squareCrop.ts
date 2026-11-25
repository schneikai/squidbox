/**
 * The square a crop keeps of a `width` × `height` picture, in its pixels: as tall as a wide picture,
 * as wide as a tall one, slid along the long side by `position` (0 the left or top end, 1 the right
 * or bottom end; outside that range it stops at the end).
 */
export default function squareCrop({ width, height }: { width: number; height: number }, position: number) {
  const side = Math.min(width, height);
  const offset = Math.round(Math.min(Math.max(position, 0), 1) * (Math.max(width, height) - side));
  return {
    originX: width > height ? offset : 0,
    originY: width > height ? 0 : offset,
    width: side,
    height: side,
  };
}
