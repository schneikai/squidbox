import { describe, it, expect } from 'vitest';

import squareCrop from '../src/features/photo-crop/squareCrop';

describe('squareCrop', () => {
  it('slides a square as tall as a wide picture along its width', () => {
    expect(squareCrop({ width: 4000, height: 3000 }, 0.5)).toEqual({
      originX: 500,
      originY: 0,
      width: 3000,
      height: 3000,
    });
  });

  it('slides a square as wide as a tall picture down its height', () => {
    expect(squareCrop({ width: 3000, height: 4000 }, 1)).toEqual({
      originX: 0,
      originY: 1000,
      width: 3000,
      height: 3000,
    });
  });

  it('stops at the ends of the picture', () => {
    expect(squareCrop({ width: 4000, height: 3000 }, -0.2).originX).toBe(0);
    expect(squareCrop({ width: 4000, height: 3000 }, 1.2).originX).toBe(1000);
  });
});
