import { TAP_SLOP } from '@/constants';

// Whether the finger at (x, y) left the point a grid's drag lifted at by more than a tap's slop, so a
// held finger's tremor still peeks (useDragReorder, useDragSelect).
export default function isPastTapSlop(liftPoint, x, y) {
  return Math.hypot(x - liftPoint.x, y - liftPoint.y) > TAP_SLOP;
}
