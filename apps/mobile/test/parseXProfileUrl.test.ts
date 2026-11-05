import { describe, it, expect } from 'vitest';

import parseXProfileUrl from '../src/features/contact-new/parseXProfileUrl';

describe('parseXProfileUrl', () => {
  it("reads the handle of a profile link X's share sheet copies", () => {
    expect(parseXProfileUrl('https://x.com/MayaL?s=21')).toEqual({ handle: 'mayal', url: 'https://x.com/MayaL?s=21' });
    expect(parseXProfileUrl(' https://twitter.com/maya_l ')?.handle).toBe('maya_l');
  });

  it("is null for a post's link, another site or plain text", () => {
    expect(parseXProfileUrl('https://x.com/mayal/status/123')).toBeNull();
    expect(parseXProfileUrl('https://bsky.app/profile/maya.bsky.social')).toBeNull();
    expect(parseXProfileUrl('https://x.com/home')).toBeNull();
    expect(parseXProfileUrl('hello')).toBeNull();
  });
});
