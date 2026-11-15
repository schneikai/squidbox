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
    const { payload, missing } = channelPayload(channelById('instagram')!, posts, contacts);
    expect(payloadText(payload)).toBe('With Sam Ridge 🌲\n\nAnd the light on the way out.');
    expect(missing.map(({ id }) => id)).toEqual(['sam']);
  });
});
