import { describe, it, expect } from 'vitest';

import isPastTapSlop from '../src/components/sortable-grid/isPastTapSlop';

const lift = { x: 100, y: 100 };

describe('isPastTapSlop', () => {
  it('lets a held finger drift further while the cell peeks before it drags', () => {
    expect(isPastTapSlop(lift, 120, 100)).toBe(true);
    expect(isPastTapSlop(lift, 120, 100, { isPeeking: true })).toBe(false);
    expect(isPastTapSlop(lift, 140, 100, { isPeeking: true })).toBe(true);
  });
});
