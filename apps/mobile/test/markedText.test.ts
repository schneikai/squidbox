import { describe, expect, it } from 'vitest';

import markedText from '../src/features/post-mentions/markedText';

describe('markedText', () => {
  it('leaves a name two contacts share as plain text, also when it differs only in case', () => {
    const read = markedText.reader([
      { id: 's1', name: 'Sam Ridge' },
      { id: 's2', name: 'sam ridge' },
    ]);
    expect(read('With @[Sam Ridge]')).toEqual({ text: 'With Sam Ridge', mentions: null });
  });

  it('reads back what it writes', () => {
    const value = {
      text: 'Sam Ridge and Maya, then Maya again',
      mentions: [
        { contactId: 'sam', location: 0, name: 'Sam Ridge' },
        { contactId: 'maya', location: 14, name: 'Maya' },
        { contactId: 'maya', location: 25, name: 'Maya' },
      ],
    };
    const read = markedText.reader([
      { id: 'sam', name: 'Sam Ridge' },
      { id: 'maya', name: 'Maya' },
    ]);
    expect(read(markedText.write(value))).toEqual(value);
  });

  it('cuts a text at its limit, a marker that would not fit whole going as its name, cut', () => {
    const value = { text: 'With Sam Ridge', mentions: [{ contactId: 'sam', location: 5, name: 'Sam Ridge' }] };
    expect(markedText.write(value, 16)).toBe('With Sam Ridge');
    expect(markedText.write(value, 8)).toBe('With Sam');
    expect(markedText.write(value, 17)).toBe('With @[Sam Ridge]');
  });
});
