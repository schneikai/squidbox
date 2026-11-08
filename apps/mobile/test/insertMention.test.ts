import { describe, expect, it } from 'vitest';

import insertMention from '../src/features/post-mentions/insertMention';

describe('insertMention', () => {
  it('replaces the typed handle with the picked one and a space, the cursor after it', () => {
    expect(insertMention('Out with @ri', { start: 9, end: 12 }, 'ridgeline')).toEqual({
      text: 'Out with @ridgeline ',
      cursor: 20,
    });
  });

  it('keeps the space that already follows, the cursor after it', () => {
    expect(insertMention('With @ri today', { start: 5, end: 8 }, 'ridgeline')).toEqual({
      text: 'With @ridgeline today',
      cursor: 16,
    });
  });
});
