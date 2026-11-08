import { describe, expect, it } from 'vitest';

import insertMention from '../src/features/post-mentions/insertMention';

describe('insertMention', () => {
  it('ends the text with the picked handle and a space, the cursor after it', () => {
    expect(insertMention('Out with @ri', { start: 9, end: 12 }, 'ridgeline')).toEqual({
      text: 'Out with @ridgeline ',
      cursor: 20,
    });
  });

  it('keeps what follows the handle as it was, the cursor right after the handle', () => {
    expect(insertMention('With @ri, today', { start: 5, end: 8 }, 'ridgeline')).toEqual({
      text: 'With @ridgeline, today',
      cursor: 15,
    });
  });
});
