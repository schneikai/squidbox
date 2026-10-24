import projectRelease from './projectRelease';

/**
 * The page a pager shifted by `shift` (points from the current page's origin, positive towards the
 * next page) lands on when released at `velocity` (points per second, positive towards the next
 * page): -1, 0 or 1. It moves on when the release would carry it past half a page, and only to the
 * side it is shifted to, as Apple Photos does: a flick back from a half-shown next page returns to
 * the current page, never across it to the previous one. A side without a neighbour stays put.
 */
export default function snapPagerShift({ shift, velocity, pageWidth, hasPrevious, hasNext }) {
  'worklet';
  const projected = projectRelease(shift, velocity);
  if (shift > 0) return hasNext && projected > pageWidth / 2 ? 1 : 0;
  if (shift < 0) return hasPrevious && projected < -pageWidth / 2 ? -1 : 0;
  return 0;
}
