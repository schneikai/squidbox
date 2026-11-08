import { describe, expect, it } from 'vitest';

import mentionAt from '../src/features/post-mentions/mentionAt';

describe('mentionAt', () => {
  it('finds the handle typed up to the cursor, at the start or after a space', () => {
    expect(mentionAt('@ri', 3)).toEqual({ start: 0, end: 3, query: 'ri' });
    expect(mentionAt('Out with @', 10)).toEqual({ start: 9, end: 10, query: '' });
  });

  it('takes the rest of a handle the cursor sits inside', () => {
    expect(mentionAt('with @ridge.bsky today', 8)).toEqual({ start: 5, end: 16, query: 'ri' });
  });

  it('finds none in an email address, after a space or with no @', () => {
    expect(mentionAt('kai@exa', 7)).toBeNull();
    expect(mentionAt('@ridge ', 7)).toBeNull();
    expect(mentionAt('hello', 5)).toBeNull();
  });
});
