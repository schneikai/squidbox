import { describe, expect, it } from 'vitest';

import relinkMentions from '../src/features/post-mentions/relinkMentions';

const SAM = { id: 'sam', name: 'Sam Ridge' };
const plain = (text: string) => ({ text, mentions: null });

describe('relinkMentions', () => {
  it('puts each chip where its name stands that no earlier chip took, and drops one whose name is gone', () => {
    const value = {
      text: 'Sam and Sam and Maya',
      mentions: [
        { contactId: 'sam1', location: 0, name: 'Sam' },
        { contactId: 'sam2', location: 8, name: 'Sam' },
        { contactId: 'maya', location: 16, name: 'Maya' },
      ],
    };
    expect(relinkMentions(value, 'Out with Sam, then Sam again').mentions).toEqual([
      { contactId: 'sam1', location: 9, name: 'Sam' },
      { contactId: 'sam2', location: 19, name: 'Sam' },
    ]);
    expect(relinkMentions(value, 'Out alone').mentions).toBeNull();
  });

  it('puts a chip on its name as a whole word, not inside a longer one', () => {
    const value = { text: 'With Mark', mentions: [{ contactId: 'mark', location: 5, name: 'Mark' }] };
    expect(relinkMentions(value, 'Marking the season with Mark').mentions).toEqual([
      { contactId: 'mark', location: 24, name: 'Mark' },
    ]);
    expect(relinkMentions(plain(''), 'Sam Ridgeline and Sam Ridges', [SAM]).mentions).toBeNull();
  });

  it("makes every whole-word place of a Mentions contact's full name a mention, also in a text with no chips", () => {
    expect(relinkMentions(plain(''), 'Sam Ridge led, Sam followed, then Sam Ridge again', [SAM])).toEqual({
      text: 'Sam Ridge led, Sam followed, then Sam Ridge again',
      mentions: [
        { contactId: 'sam', location: 0, name: 'Sam Ridge' },
        { contactId: 'sam', location: 34, name: 'Sam Ridge' },
      ],
    });
  });

  it('takes the longer of two overlapping names, and of two contacts with one name the first', () => {
    const mentioned = [
      { id: 'sam', name: 'Sam' },
      { id: 'ridge1', name: 'Sam Ridge' },
      { id: 'ridge2', name: 'Sam Ridge' },
    ];
    expect(relinkMentions(plain(''), 'With Sam Ridge', mentioned).mentions).toEqual([
      { contactId: 'ridge1', location: 5, name: 'Sam Ridge' },
    ]);
  });

  it('drops an @ right before a mention, and the mentions after it hold their names', () => {
    const maya = { id: 'maya', name: 'Maya' };
    expect(relinkMentions(plain(''), 'With @Sam Ridge and @Maya', [SAM, maya])).toEqual({
      text: 'With Sam Ridge and Maya',
      mentions: [
        { contactId: 'sam', location: 5, name: 'Sam Ridge' },
        { contactId: 'maya', location: 19, name: 'Maya' },
      ],
    });
  });

  it("places the card's own chips first: a Mentions name takes only what they left", () => {
    const value = { text: 'Sam Ridge', mentions: [{ contactId: 'other', location: 0, name: 'Sam Ridge' }] };
    expect(relinkMentions(value, 'Sam Ridge and Sam Ridge', [SAM]).mentions).toEqual([
      { contactId: 'other', location: 0, name: 'Sam Ridge' },
      { contactId: 'sam', location: 14, name: 'Sam Ridge' },
    ]);
  });
});
