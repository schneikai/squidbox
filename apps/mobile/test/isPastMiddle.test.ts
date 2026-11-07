import { describe, it, expect } from 'vitest';

import isPastMiddle from '../src/features/prompt-buttons/isPastMiddle';

const frame = { x: 100, y: 0, width: 50, height: 32 };

describe('isPastMiddle', () => {
  it("moves forward only once the finger has crossed the chip's middle", () => {
    expect(isPastMiddle({ x: 124, y: 10 }, frame, true)).toBe(false);
    expect(isPastMiddle({ x: 125, y: 10 }, frame, true)).toBe(true);
  });

  it('moves back only once the finger has crossed the middle the other way', () => {
    expect(isPastMiddle({ x: 126, y: 10 }, frame, false)).toBe(false);
    expect(isPastMiddle({ x: 125, y: 10 }, frame, false)).toBe(true);
  });

  it("never swaps with a chip it can't find", () => {
    expect(isPastMiddle({ x: 125, y: 10 }, undefined, true)).toBe(false);
  });
});
