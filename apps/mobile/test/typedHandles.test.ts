import { describe, expect, it } from 'vitest';

import typedHandles from '../src/features/post-mentions/typedHandles';

describe('typedHandles', () => {
  it('finds handles with dots and hyphens, and none in an email address', () => {
    expect(typedHandles('Out with @ridgeline.bsky.social and @trail-mix today. Mail kai@example.com')).toEqual([
      '@ridgeline.bsky.social',
      '@trail-mix',
    ]);
  });

  it('finds none inside a URL, nor a handle cut short by a letter no handle has', () => {
    expect(typedHandles('See https://tiktok.com/@sam and x.com?u=@lee. Hola @josé, and (@maya)')).toEqual(['@maya']);
  });

  it('finds a handle after punctuation that is no URL', () => {
    expect(typedHandles('Shoot w/@ridgeline.bsky.social 📸:@maya ft.@sam')).toEqual([
      '@ridgeline.bsky.social',
      '@maya',
      '@sam',
    ]);
  });

  it('leaves a trailing period or hyphen out of the handle', () => {
    expect(typedHandles('Thanks @ridgeline. With @sam- and @lee.bsky.social, again')).toEqual([
      '@ridgeline',
      '@sam',
      '@lee.bsky.social',
    ]);
  });

  it('gives a handle once without case, in its first spelling', () => {
    expect(typedHandles('@Sam and @alex, then @SAM')).toEqual(['@Sam', '@alex']);
  });
});
