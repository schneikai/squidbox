import { channelById } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import channelPayload, { payloadText } from '../src/features/send-to-channels/channelPayload';

const sam = { id: 'sam', name: 'Sam Ridge', blueskyHandle: 'ridgeline.bsky.social' };
const contacts = new Map([[sam.id, sam]]);
const posts = [
  { text: 'With Sam Ridge 🌲', mentions: [{ contactId: 'sam', location: 5, name: 'Sam Ridge' }], assetIds: ['a1'] },
  { text: '  ', mentions: null, assetIds: ['a2'] },
  { text: 'And the light on the way out.', mentions: null, assetIds: [] },
];

describe('channelPayload', () => {
  it("sends a thread's posts in order, each caption as the channel gets it, with its assets", () => {
    const { payload } = channelPayload(channelById('bluesky')!, posts, contacts);
    expect(payload).toEqual({
      channelId: 'bluesky',
      posts: [
        { caption: 'With @ridgeline.bsky.social 🌲', assetIds: ['a1'] },
        { caption: '  ', assetIds: ['a2'] },
        { caption: 'And the light on the way out.', assetIds: [] },
      ],
    });
  });

  it("joins a thread's captions by a blank line, leaving out an empty one", () => {
    const { payload } = channelPayload(channelById('instagram')!, posts, contacts);
    expect(payloadText(payload)).toBe('With Sam Ridge 🌲\n\nAnd the light on the way out.');
  });

  it('lists a contact without a handle on the channel once, however many posts mention them', () => {
    const maya = { id: 'maya', name: 'Maya Lindqvist' };
    const thread = [
      { text: 'Maya Lindqvist and Sam Ridge', mentions: [mention(maya, 0), mention(sam, 19)], assetIds: [] },
      { text: 'Sam Ridge again', mentions: [mention(sam, 0)], assetIds: [] },
    ];
    const { missing } = channelPayload(channelById('instagram')!, thread, new Map([...contacts, [maya.id, maya]]));
    expect(missing.map(({ id }) => id)).toEqual(['maya', 'sam']);
  });
});

function mention(contact: { id: string; name: string }, location: number) {
  return { contactId: contact.id, location, name: contact.name };
}
