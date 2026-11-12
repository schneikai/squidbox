import { describe, it, expect } from 'vitest';

import handleLink from '../src/features/contact-detail/handleLink';

describe('handleLink', () => {
  it("links a handle to its network's profile", () => {
    expect(handleLink('xHandle', '@MayaL')).toBe('https://x.com/MayaL');
  });

  it('links a saved link as saved, with https:// when it has no scheme', () => {
    expect(handleLink('onlyFansHandle', 'onlyfans.com/maya')).toBe('https://onlyfans.com/maya');
    expect(handleLink('xHandle', 'https://x.com/i/lists/1')).toBe('https://x.com/i/lists/1');
  });

  it('is null for an empty field', () => {
    expect(handleLink('xHandle', '')).toBeNull();
  });
});
