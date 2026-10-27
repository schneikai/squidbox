import { describe, expect, it } from 'vitest';

import extractHandles from '../src/utils/posts/extractHandles';

describe('extractHandles', () => {
  it('finds handles with dots and hyphens, and none in an email address', () => {
    expect(
      extractHandles(['Out with @ridgeline.bsky.social and @trail-mix today', 'Mail me at kai@example.com']),
    ).toEqual(['@ridgeline.bsky.social', '@trail-mix']);
  });

  it('leaves a trailing period or hyphen out of the handle', () => {
    expect(extractHandles(['Thanks @ridgeline.', 'With @sam- and @lee.bsky.social, again'])).toEqual([
      '@ridgeline',
      '@sam',
      '@lee.bsky.social',
    ]);
  });

  it('counts a handle once without case, keeping its first spelling, the most used first', () => {
    expect(extractHandles(['@Alex and @sam', '@sam again', 'and @SAM', '@alex'])).toEqual(['@sam', '@Alex']);
  });

  it('keeps the first seen first between handles used as often', () => {
    expect(extractHandles(['@b @a', '@c'])).toEqual(['@b', '@a', '@c']);
    expect(extractHandles([])).toEqual([]);
  });
});
