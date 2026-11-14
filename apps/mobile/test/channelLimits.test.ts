import { describe, expect, it } from 'vitest';

import isMediaOver from '../src/features/channels/isMediaOver';
import textLength from '../src/features/channels/textLength';
import textLimit from '../src/features/channels/textLimit';
import versionLimits from '../src/features/channels/versionLimits';

const x = { maxTextLength: 280, maxMedia: 4, textLimitOf: null };
const unlimited = { maxTextLength: null, maxMedia: null, textLimitOf: null };

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

  it("takes a shared version's strictest limits, and names the channel of the text's in the counter", () => {
    const limits = versionLimits(['bluesky', 'x']);
    expect(limits).toMatchObject({ maxTextLength: 280, maxMedia: 4, textLimitOf: 'X', threadless: [] });
    expect(textLimit(limits, 'a'.repeat(281))).toEqual({ counter: '281 / 280 · X', isOver: true });
    expect(versionLimits(['x'])?.textLimitOf).toBeNull();
  });

  it('names the channel whose media limit a shared version takes, and none on one channel', () => {
    expect(versionLimits(['onlyfans', 'x'])).toMatchObject({ maxMedia: 4, mediaLimitOf: 'X' });
    expect(versionLimits(['x'])?.mediaLimitOf).toBeNull();
  });

  it('lists the channels of a version that have no threads', () => {
    expect(versionLimits(['x', 'instagram', 'onlyfans'])?.threadless).toEqual(['Instagram', 'OnlyFans']);
  });

  it('has no limits for a version without a channel this build knows', () => {
    expect(versionLimits([])).toBeUndefined();
    expect(versionLimits(['mastodon'])).toBeUndefined();
  });
});
