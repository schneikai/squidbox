import { describe, expect, it } from 'vitest';

import counterText from '../src/features/channels/counterText';
import isMediaOver from '../src/features/channels/isMediaOver';
import isTextOver from '../src/features/channels/isTextOver';
import textLength from '../src/features/channels/textLength';

const x = { maxTextLength: 280, maxMedia: 4 };
const unlimited = { maxTextLength: null, maxMedia: null };

describe('channelLimits', () => {
  it('is over only above the limit', () => {
    expect(isTextOver(x, 'a'.repeat(280))).toBe(false);
    expect(isTextOver(x, 'a'.repeat(281))).toBe(true);
    expect(isMediaOver(x, 4)).toBe(false);
    expect(isMediaOver(x, 5)).toBe(true);
  });

  it('is never over without a limit', () => {
    expect(isTextOver(unlimited, 'a'.repeat(100_000))).toBe(false);
    expect(isMediaOver(unlimited, 1000)).toBe(false);
    expect(counterText(unlimited, 'hi')).toBeNull();
  });

  it('counts a character outside the BMP, one code point, once', () => {
    expect(textLength('🌲')).toBe(1);
    expect(counterText(x, `${'a'.repeat(254)}Ridge 🌲`)).toBe('261 / 280');
  });

  it('shows the counter only once the text is near the limit', () => {
    expect(counterText(x, 'a'.repeat(251))).toBeNull();
    expect(counterText(x, 'a'.repeat(252))).toBe('252 / 280');
  });
});
