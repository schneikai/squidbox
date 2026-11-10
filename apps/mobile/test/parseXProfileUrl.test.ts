import { describe, it, expect } from 'vitest';

import parseXProfileUrl from '../src/features/contact-new/parseXProfileUrl';

describe('parseXProfileUrl', () => {
  it("reads the handle of a profile link X's share sheet copies, in the link's case", () => {
    expect(parseXProfileUrl('https://x.com/MayaL?s=21')).toEqual({ handle: 'MayaL', url: 'https://x.com/MayaL?s=21' });
    expect(parseXProfileUrl(' https://twitter.com/maya_l ')?.handle).toBe('maya_l');
  });

  it('reads a link from every X host the handle field takes, to the same handle', () => {
    for (const url of [
      'https://mobile.twitter.com/MayaL',
      'https://www.mobile.x.com/MayaL',
      'http://twitter.com/@MayaL',
    ]) {
      expect(parseXProfileUrl(url)?.handle).toBe('MayaL');
    }
  });

  it("reads a post's link as its author's profile", () => {
    expect(parseXProfileUrl('https://x.com/mayal/status/123')?.handle).toBe('mayal');
  });

  it('is null for a page of X that is no profile, another site or plain text', () => {
    expect(parseXProfileUrl('https://bsky.app/profile/maya.bsky.social')).toBeNull();
    expect(parseXProfileUrl('https://x.com/home')).toBeNull();
    expect(parseXProfileUrl('hello')).toBeNull();
  });
});
