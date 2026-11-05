import { describe, expect, it } from 'vitest';
import { splitAtLink } from '../scripts/splitAtLink.js';

describe('splitAtLink', () => {
  it('splits before the first paragraph with the link and keeps the lines after it with it', () => {
    const text = 'Golden hour on the ridge.\n\nMore on onlyfans.com/me\n\n🔥 Be quick 🔥\n\njustfor.fans/me';
    expect(splitAtLink(text)).toEqual({
      first: 'Golden hour on the ridge.',
      following: 'More on onlyfans.com/me\n\n🔥 Be quick 🔥\n\njustfor.fans/me',
    });
  });

  it('keeps every paragraph before the link in the first post', () => {
    expect(splitAtLink('One.\n\nTwo.\n \nJustFor.Fans/me')).toEqual({
      first: 'One.\n\nTwo.',
      following: 'JustFor.Fans/me',
    });
  });

  it('leaves a post alone when the link is in its first paragraph or it has none', () => {
    expect(splitAtLink('New set on onlyfans.com/me\n\nOut now')).toBeNull();
    expect(splitAtLink('Line one\nonlyfans.com/me')).toBeNull();
    expect(splitAtLink('Just a hike.\n\nNo link.')).toBeNull();
  });
});
