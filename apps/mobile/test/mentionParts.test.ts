import { describe, expect, it } from 'vitest';

import mentionParts from '../src/features/post-mentions/mentionParts';

const maya = { contactId: 'maya', location: 5, name: 'Maya' };

describe('mentionParts', () => {
  it('cuts a text into its plain runs and its mentions', () => {
    expect(mentionParts('With Maya today', [maya])).toEqual([
      { kind: 'text', text: 'With ' },
      { kind: 'mention', mention: maya },
      { kind: 'text', text: ' today' },
    ]);
  });

  it('counts a mention only where the text still has its name', () => {
    expect(mentionParts('With Mia today', [maya])).toEqual([{ kind: 'text', text: 'With Mia today' }]);
  });

  it('drops a mention that overlaps an earlier one or points past the text', () => {
    const overlapping = { contactId: 'ya', location: 7, name: 'ya' };
    const past = { contactId: 'sam', location: 40, name: 'Sam' };
    expect(mentionParts('With Maya', [overlapping, maya, past])).toEqual([
      { kind: 'text', text: 'With ' },
      { kind: 'mention', mention: maya },
    ]);
  });
});
