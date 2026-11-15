import { describe, expect, it } from 'vitest';

import { MENTION_CHIP } from '../src/features/post-mentions/fieldContent';
import mentionAt from '../src/features/post-mentions/mentionAt';

describe('mentionAt', () => {
  it('finds what is typed after an @ up to the cursor, at the start or after a space', () => {
    expect(mentionAt('@ri', 3)).toEqual({ start: 0, end: 3, query: 'ri' });
    expect(mentionAt('Out with @', 10)).toEqual({ start: 9, end: 10, query: '' });
  });

  it('takes a name with spaces', () => {
    expect(mentionAt('Hi @Maya Lin', 12)).toEqual({ start: 3, end: 12, query: 'Maya Lin' });
  });

  it('ends at the cursor', () => {
    expect(mentionAt('with @ridge today', 8)).toEqual({ start: 5, end: 8, query: 'ri' });
  });

  it('finds none in an email address', () => {
    expect(mentionAt('kai@exa', 7)).toBeNull();
  });

  it('takes a chip before the @ as a boundary, and stops at a chip or a line break after it', () => {
    expect(mentionAt(`${MENTION_CHIP}@sa`, 4)).toEqual({ start: 1, end: 4, query: 'sa' });
    expect(mentionAt(`@sa${MENTION_CHIP}x`, 5)).toBeNull();
    expect(mentionAt('@sa\nx', 5)).toBeNull();
    expect(mentionAt('Hi\n@sa', 6)).toEqual({ start: 3, end: 6, query: 'sa' });
  });

  it('finds none past 40 characters after the @', () => {
    const typed = 'a'.repeat(41);
    expect(mentionAt(`@${typed}`, 42)).toBeNull();
    expect(mentionAt(`@${typed.slice(1)}`, 41)).toEqual({ start: 0, end: 41, query: typed.slice(1) });
  });
});
