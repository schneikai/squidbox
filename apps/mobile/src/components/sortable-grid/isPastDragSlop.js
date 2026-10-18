// How far a lifted cell's finger moves before it drags: UIKit's drag slop, so a held finger's tremor
// still peeks.
const DRAG_SLOP = 10;

// Whether the finger at (x, y) left the point it lifted the cell at by more than the drag slop.
export default function isPastDragSlop(liftPoint, x, y) {
  return Math.hypot(x - liftPoint.x, y - liftPoint.y) > DRAG_SLOP;
}
