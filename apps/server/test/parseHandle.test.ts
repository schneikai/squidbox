import { describe, it, expect } from 'vitest';
import { handleKey, parseHandle } from '@squidbox/shared';

describe('parseHandle and handleKey', () => {
  it('a handle keeps its case and loses only its @s and spaces', () => {
    expect(parseHandle(' @MayaL ')).toEqual({ kind: 'handle', handle: 'MayaL' });
  });

  it('every spelling of one handle has one key', () => {
    expect(['@MayaL', 'mayal', 'https://x.com/MayaL?s=21'].map((text) => handleKey(text))).toEqual([
      'mayal',
      'mayal',
      'mayal',
    ]);
  });

  it("another network's profile link is no handle of the field it is in, and its key is the link", () => {
    expect(parseHandle('https://instagram.com/maya', 'xHandle')).toMatchObject({
      kind: 'link',
      field: 'instagramHandle',
      handle: null,
    });
    expect(handleKey('https://instagram.com/maya', 'xHandle')).toBe('instagram.com/maya');
    expect(handleKey('https://instagram.com/maya', 'instagramHandle')).toBe('maya');
  });

  it.each([
    ['x.com/MayaL?s=21', 'xHandle', 'MayaL'],
    ['twitter.com/MayaL', 'xHandle', 'MayaL'],
    ['mobile.x.com/MayaL', 'xHandle', 'MayaL'],
    ['https://www.instagram.com/maya.l/', 'instagramHandle', 'maya.l'],
    ['m.instagram.com/maya', 'instagramHandle', 'maya'],
    ['bsky.app/profile/maya.bsky.social', 'blueskyHandle', 'maya.bsky.social'],
    ['onlyfans.com/maya', 'onlyFansHandle', 'maya'],
    ['justfor.fans/maya?ref=1', 'jffHandle', 'maya'],
    ['twitter.com/mayal/status/1', 'xHandle', 'mayal'],
    ['x.com/MayaL/media', 'xHandle', 'MayaL'],
    ['instagram.com/maya/reels/', 'instagramHandle', 'maya'],
    ['bsky.app/profile/maya.bsky.social/post/abc', 'blueskyHandle', 'maya.bsky.social'],
  ])('a profile link yields its handle from its first path segment: %s', (text, field, handle) => {
    expect(parseHandle(text)).toMatchObject({ kind: 'link', field, handle });
  });

  it.each([
    ['x.com/i/lists/1', 'xHandle'],
    ['x.com/intent/user?user_id=1', 'xHandle'],
    ['x.com/home', 'xHandle'],
    ['instagram.com/p/abc', 'instagramHandle'],
    ['instagram.com/reel/abc', 'instagramHandle'],
    ['bsky.app/profile/did:plc:abc', 'blueskyHandle'],
    ['onlyfans.com/123456/maya', 'onlyFansHandle'],
    ['onlyfans.com/123456', 'onlyFansHandle'],
    ['https://linktr.ee/maya', null],
    ['instagram.com/_u/maya', 'instagramHandle'],
    ['onlyfans.com/my/chats', 'onlyFansHandle'],
    ['x.com/login', 'xHandle'],
    ['x.com/tos', 'xHandle'],
    ['x.com/privacy', 'xHandle'],
    ['x.com/download', 'xHandle'],
  ])('a link that is no profile yields no handle, and its key is the link: %s', (text, field) => {
    expect(parseHandle(text)).toMatchObject({ kind: 'link', field, handle: null });
    expect([
      'i',
      'intent',
      'p',
      'reel',
      'did:plc:abc',
      '123456',
      'linktr.ee',
      '_u',
      'my',
      'login',
      'tos',
    ]).not.toContain(handleKey(text));
  });

  it("a link's key ignores its scheme, www. and a trailing slash, and keeps its query", () => {
    expect(handleKey('https://www.x.com/i/lists/1')).toBe(handleKey('x.com/i/lists/1/'));
    expect(handleKey('x.com/i/lists/1?x=1')).not.toBe(handleKey('x.com/i/lists/1'));
    expect(handleKey('x.com/i/lists/1/?s=2')).toBe(handleKey('x.com/i/lists/1?s=2'));
  });

  it('an empty text or only @s is empty, with an empty key', () => {
    for (const text of ['', '   ', '@', ' @@ ']) {
      expect(parseHandle(text)).toEqual({ kind: 'empty', handle: null });
      expect(handleKey(text)).toBe('');
    }
  });
});
