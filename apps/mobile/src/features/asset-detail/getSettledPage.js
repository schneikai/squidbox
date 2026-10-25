// How far from a page's origin a scroll still counts as resting on it (rounding of the offset).
const ALIGNED_WITHIN = 1;

/**
 * The page a horizontal pager rests on at `offset` (points), or -1 while it's between pages. Native
 * paging always ends on a page; an end event between pages comes from a programmatic scroll (on iOS
 * every `scrollTo` of the zoomed photo's edge swipe fires one), which must not count as a swipe.
 */
export default function getSettledPage(offset, pageWidth) {
  if (pageWidth <= 0) return -1;
  const index = Math.round(offset / pageWidth);
  return Math.abs(offset - index * pageWidth) <= ALIGNED_WITHIN ? index : -1;
}
