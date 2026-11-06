import { describe, expect, it } from 'vitest';
import { handlesInText } from '../src/contacts/handlesInText.js';

describe('handlesInText', () => {
  it('reads an OnlyFans website without the path after the handle', () => {
    expect(handlesInText(['https://onlyfans.com/MayaL/c17?ref=x'])).toEqual({ onlyFansHandle: 'mayal' });
  });

  it('reads a Bluesky profile link', () => {
    expect(handlesInText(['more at https://bsky.app/profile/maya.bsky.social'])).toEqual({
      blueskyHandle: 'maya.bsky.social',
    });
  });

  it('reads a bare Bluesky handle, lowercased', () => {
    expect(handlesInText(['🦋 Maya.bsky.social'])).toEqual({ blueskyHandle: 'maya.bsky.social' });
  });

  it('reads a JFF link, without a full stop after it', () => {
    expect(handlesInText(['Everything else: justfor.fans/MayaL.'])).toEqual({ jffHandle: 'mayal' });
  });

  it('finds nothing in an X link', () => {
    expect(handlesInText(['https://x.com/MayaL'])).toEqual({});
  });

  it('keeps the first handle of each network', () => {
    expect(handlesInText(['onlyfans.com/first', 'onlyfans.com/second justfor.fans/maya'])).toEqual({
      onlyFansHandle: 'first',
      jffHandle: 'maya',
    });
  });
});
