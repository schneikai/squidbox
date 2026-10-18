import { describe, it, expect } from 'vitest';

import getDetailsMediaCover from '../src/features/asset-detail/details/getDetailsMediaCover';

// A 430 × 930 page, the band above the open panel its top third.
const page = { width: 430, height: 930, bandHeight: 310 };

describe('details panel: how the photo covers the band above it (getDetailsMediaCover)', () => {
  it('keeps a photo as wide as the page and taller than the band at its size, centered in the band', () => {
    // A square photo is 430 × 430, centered at 465; the band at 155.
    expect(getDetailsMediaCover({ ...page, aspectRatio: 1 })).toEqual({ scale: 1, translateY: -310 });
  });

  it('grows a wide photo lower than the band until it fills the band', () => {
    // A 2:1 photo is 430 × 215.
    expect(getDetailsMediaCover({ ...page, aspectRatio: 2 }).scale).toBeCloseTo(310 / 215);
  });

  it('grows a tall photo narrower than the page until it fills the width', () => {
    // A 1:3 photo is 310 × 930.
    expect(getDetailsMediaCover({ ...page, aspectRatio: 1 / 3 }).scale).toBeCloseTo(430 / 310);
  });

  it('takes a photo of unknown shape to fill the page', () => {
    expect(getDetailsMediaCover({ ...page, aspectRatio: NaN }).scale).toBe(1);
  });
});
