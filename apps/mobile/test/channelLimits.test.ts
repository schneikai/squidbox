import { describe, expect, it } from 'vitest';

import isMediaOver from '../src/features/channels/isMediaOver';
import textLength from '../src/features/channels/textLength';
import textLimit from '../src/features/channels/textLimit';

const x = { maxTextLength: 280, maxMedia: 4 };
const unlimited = { maxTextLength: null, maxMedia: null };

describe('channelLimits', () => {
  it('is over only above the limit', () => {
    expect(textLimit(x, 'a'.repeat(280)).isOver).toBe(false);
    expect(textLimit(x, 'a'.repeat(281)).isOver).toBe(true);
    expect(isMediaOver(x, 4)).toBe(false);
    expect(isMediaOver(x, 5)).toBe(true);
  });

  it('is never over without a limit', () => {
    expect(textLimit(unlimited, 'a'.repeat(100_000))).toEqual({ counter: null, isOver: false });
    expect(isMediaOver(unlimited, 1000)).toBe(false);
  });

  it('counts a character outside the BMP, one code point, once', () => {
    expect(textLength('🌲')).toBe(1);
    expect(textLimit(x, `${'a'.repeat(254)}Ridge 🌲`).counter).toBe('261 / 280');
    expect(textLimit(x, '🌲'.repeat(150)).counter).toBeNull();
  });

  it('shows the counter only once the text is near the limit', () => {
    expect(textLimit(x, 'a'.repeat(251)).counter).toBeNull();
    expect(textLimit(x, 'a'.repeat(252)).counter).toBe('252 / 280');
  });
});
