import { describe, it, expect } from 'vitest';

import isPastDragSlop from '../src/components/sortable-grid/isPastDragSlop';

const liftPoint = { x: 100, y: 200 };

describe('the sortable grid’s drag slop', () => {
  it('keeps a lifted cell still while the finger only trembles, so holding it can still peek', () => {
    expect(isPastDragSlop(liftPoint, 100, 200)).toBe(false);
    expect(isPastDragSlop(liftPoint, 106, 208)).toBe(false); // exactly 10 away
  });

  it('drags once the finger moves past the slop, in any direction', () => {
    expect(isPastDragSlop(liftPoint, 111, 200)).toBe(true);
    expect(isPastDragSlop(liftPoint, 100, 189)).toBe(true);
    expect(isPastDragSlop(liftPoint, 92, 192)).toBe(true);
  });
});
