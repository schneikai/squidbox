import { describe, expect, it } from 'vitest';

import { fromFieldContent, MENTION_CHIP, toFieldContent } from '../src/features/post-mentions/fieldContent';

const value = {
  text: 'Up with Maya and Sam',
  mentions: [
    { contactId: 'maya', location: 8, name: 'Maya' },
    { contactId: 'sam', location: 17, name: 'Sam' },
  ],
};

describe('fieldContent', () => {
  it('holds each mention as one chip character in the field, and writes it back as the stored text', () => {
    const content = toFieldContent(value, (mention) => ({ label: mention.name, avatarUri: null }));
    expect(content).toEqual({
      text: `Up with ${MENTION_CHIP} and ${MENTION_CHIP}`,
      mentions: [
        { id: 'maya', label: 'Maya', location: 8, avatarUri: null },
        { id: 'sam', label: 'Sam', location: 14, avatarUri: null },
      ],
    });
    expect(fromFieldContent(content, (chip) => chip.label)).toEqual(value);
  });

  it("writes a renamed contact's new name only once the field reports an edit", () => {
    const names = new Map([
      ['maya', 'Maya Lindqvist'],
      ['sam', 'Sam'],
    ]);
    const content = toFieldContent(value, (mention) => ({ label: names.get(mention.contactId)! }));
    expect(fromFieldContent(content, (chip) => names.get(chip.id)!)).toEqual({
      text: 'Up with Maya Lindqvist and Sam',
      mentions: [
        { contactId: 'maya', location: 8, name: 'Maya Lindqvist' },
        { contactId: 'sam', location: 27, name: 'Sam' },
      ],
    });
  });

  it('stores no mentions for a text without chips, and drops a chip character without a chip', () => {
    expect(fromFieldContent({ text: `Hi${MENTION_CHIP}!`, mentions: [] }, () => 'x')).toEqual({
      text: 'Hi!',
      mentions: null,
    });
  });
});
