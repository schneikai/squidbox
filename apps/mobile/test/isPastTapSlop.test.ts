import { describe, it, expect, vi } from 'vitest';

import isPastTapSlop from '../src/components/sortable-grid/isPastTapSlop';

// constants.js takes SCREEN_PADDING from the design tokens, which load React Native.
vi.mock('@/styles/designTokens', () => ({ layout: { sideGutter: 16 } }));

const lift = { x: 100, y: 100 };

describe('isPastTapSlop', () => {
  it('lets a held finger drift further while the cell peeks before it drags', () => {
    expect(isPastTapSlop(lift, 120, 100)).toBe(true);
    expect(isPastTapSlop(lift, 120, 100, { isPeeking: true })).toBe(false);
    expect(isPastTapSlop(lift, 140, 100, { isPeeking: true })).toBe(true);
  });
});
