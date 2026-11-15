import { describe, expect, it } from 'vitest';

import relinkMentions from '../src/features/post-mentions/relinkMentions';

describe('relinkMentions', () => {
  it('puts each chip at the first place its name stands that no earlier chip took, and drops one whose name is gone', () => {
    const value = {
      text: 'Sam and Sam and Maya',
      mentions: [
        { contactId: 'sam1', location: 0, name: 'Sam' },
        { contactId: 'sam2', location: 8, name: 'Sam' },
        { contactId: 'maya', location: 16, name: 'Maya' },
      ],
    };
    expect(relinkMentions(value, 'Out with Sam, then Sam again')).toEqual([
      { contactId: 'sam1', location: 9, name: 'Sam' },
      { contactId: 'sam2', location: 19, name: 'Sam' },
    ]);
    expect(relinkMentions(value, 'Out alone')).toBeNull();
  });
});
