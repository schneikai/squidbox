import type { LayoutRectangle } from 'react-native';

import type { Point } from '@/lib/Point';

// Whether the finger crossed the middle of the chip it is over, in the direction it moves: a chip
// wider than the lifted one swaps only then, so the swap doesn't flip back under a still finger.
export default function isPastMiddle(
  point: Point,
  frame: LayoutRectangle | undefined,
  isMovingForward: boolean,
): boolean {
  if (!frame) return false;
  const middle = frame.x + frame.width / 2;
  return isMovingForward ? point.x >= middle : point.x <= middle;
}
