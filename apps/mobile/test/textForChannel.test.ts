import { CHANNELS } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import textForChannel from '../src/features/post-mentions/textForChannel';

const channel = (id: string) => CHANNELS.find((c) => c.id === id)!;

const maya = { id: 'maya', name: 'Maya Lindqvist', blueskyHandle: 'maya.bsky.social', onlyFansHandle: '@mayalq' };
const sam = {
  id: 'sam',
  name: 'Sam Ridge',
  xHandle: 'https://x.com/samridge',
  instagramHandle: 'https://example.com/sam',
};
const contacts = new Map([maya, sam].map((c) => [c.id, c]));
const value = {
  text: 'Maya Lindqvist and Sam Ridge, then Gone',
  mentions: [
    { contactId: 'maya', location: 0, name: 'Maya Lindqvist' },
    { contactId: 'sam', location: 19, name: 'Sam Ridge' },
    { contactId: 'deleted', location: 35, name: 'Gone' },
  ],
};

describe('textForChannel', () => {
  it("writes a mention as @ and the contact's handle there", () => {
    expect(textForChannel(value, contacts, channel('bluesky')).text).toBe('@maya.bsky.social and Sam Ridge, then Gone');
  });

  it('writes the name for a contact without a handle there, and lists it once as missing', () => {
    const { text, missing } = textForChannel(value, contacts, channel('bluesky'));
    expect(text).toContain('and Sam Ridge,');
    expect(missing.map(({ id }) => id)).toEqual(['sam']);
  });

  it("takes a stored profile link's handle, and no handle from another link", () => {
    expect(textForChannel(value, contacts, channel('x')).text).toBe('Maya Lindqvist and @samridge, then Gone');
    expect(textForChannel(value, contacts, channel('instagram')).missing.map(({ id }) => id)).toEqual(['maya', 'sam']);
  });

  it('tags with @ on OnlyFans too', () => {
    expect(textForChannel(value, contacts, channel('onlyfans')).text).toMatch(/^@mayalq and/);
  });

  it("writes a deleted contact's stored name, and does not list it", () => {
    const { text, missing } = textForChannel(value, contacts, channel('onlyfans'));
    expect(text).toMatch(/then Gone$/);
    expect(missing.map(({ id }) => id)).toEqual(['sam']);
  });
});
