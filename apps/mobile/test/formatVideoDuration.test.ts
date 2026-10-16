import { describe, it, expect } from 'vitest';

import formatVideoDuration from '../src/utils/formatVideoDuration';

describe('formatVideoDuration', () => {
  it('shows milliseconds as m:ss', () => {
    expect(formatVideoDuration(0)).toBe('0:00');
    expect(formatVideoDuration(7000)).toBe('0:07');
    expect(formatVideoDuration(754000)).toBe('12:34');
  });

  it('rounds to the nearest second without a 60 in the seconds', () => {
    expect(formatVideoDuration(59600)).toBe('1:00');
    expect(formatVideoDuration(119500)).toBe('2:00');
    expect(formatVideoDuration(61400)).toBe('1:01');
  });

  it('shows nothing without a duration', () => {
    expect(formatVideoDuration(null)).toBeUndefined();
    expect(formatVideoDuration(undefined)).toBeUndefined();
  });
});
