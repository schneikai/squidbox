import { describe, it, expect } from 'vitest';

import getDetailsMediaShift from '../src/features/asset-detail/details/getDetailsMediaShift';

// A 430 × 932 page, the panel its lower half (its top at 466), the header ending at 150.
const page = { width: 430, height: 932, panelHeight: 466, headerBottom: 150 };

describe('details panel: how far the photo moves up (getDetailsMediaShift)', () => {
  it('moves a photo filling the page up by the whole panel', () => {
    expect(getDetailsMediaShift({ ...page, aspectRatio: 0.46 })).toBe(466);
  });

  it('moves a photo too tall for the room above the panel just until it ends at the panel', () => {
    // A square photo is 430 tall, its bottom at 681.
    expect(getDetailsMediaShift({ ...page, aspectRatio: 1 })).toBe(215);
  });

  it('centers a photo that fits between the header and the panel', () => {
    // A 3:2 photo is 287 tall, centered at 466; the room between 150 and 466 is centered at 308.
    expect(getDetailsMediaShift({ ...page, aspectRatio: 1.5 })).toBe(158);
  });

  it('takes a photo of unknown shape to fill the page', () => {
    expect(getDetailsMediaShift({ ...page, aspectRatio: NaN })).toBe(466);
  });
});
