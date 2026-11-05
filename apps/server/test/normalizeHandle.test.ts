import { describe, it, expect } from 'vitest';
import { normalizeHandle } from '@squidbox/shared';

describe('normalizeHandle', () => {
  it('drops a leading @ and lowercases', () => {
    expect(normalizeHandle('  @MayaL ')).toBe('mayal');
  });

  it('takes the handle out of a profile URL, with its query and path', () => {
    expect(normalizeHandle('https://x.com/MayaL?s=21')).toBe('mayal');
    expect(normalizeHandle('https://www.twitter.com/mayal/status/1')).toBe('mayal');
    expect(normalizeHandle('bsky.app/profile/maya.bsky.social')).toBe('maya.bsky.social');
    expect(normalizeHandle('http://onlyfans.com/maya')).toBe('maya');
    expect(normalizeHandle('https://justfor.fans/maya?ref=1')).toBe('maya');
  });

  it('keeps the dots of a Bluesky handle', () => {
    expect(normalizeHandle('@Maya.bsky.social')).toBe('maya.bsky.social');
  });

  it('is empty for an empty input', () => {
    expect(normalizeHandle('   ')).toBe('');
  });
});
