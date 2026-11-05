import { PEEK_DRAG_SLOP, TAP_SLOP } from '@/constants';

// Whether the finger at (x, y) left the point a grid's drag lifted at by more than a tap's slop, or
// the wider PEEK_DRAG_SLOP while the cell peeks, so a held finger's drift still peeks and keeps the
// quick view open (useDragReorder, useDragSelect).
export default function isPastTapSlop(liftPoint, x, y, { isPeeking = false } = {}) {
  return Math.hypot(x - liftPoint.x, y - liftPoint.y) > (isPeeking ? PEEK_DRAG_SLOP : TAP_SLOP);
}
