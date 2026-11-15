import { describe, expect, it } from 'vitest';

import contactsByHandle from '../src/features/post-mentions/contactsByHandle';
import linkTypedHandles from '../src/features/post-mentions/linkTypedHandles';

const sam = { id: 'sam', name: 'Sam Ridge', blueskyHandle: 'ridgeline.bsky.social' };
const maya = { id: 'maya', name: 'Maya Lindqvist', xHandle: 'https://x.com/mayal' };
const twins = [
  { id: 'lee1', name: 'Lee', xHandle: 'lee' },
  { id: 'lee2', name: 'Lee B', instagramHandle: 'lee' },
];
const ofHandle = contactsByHandle([sam, maya, ...twins]);

describe('linkTypedHandles', () => {
  it("makes a handle that means one contact that contact's name and chip, the mentions after it moved", () => {
    const theo = { contactId: 'theo', location: 37, name: 'Theo' };
    expect(linkTypedHandles({ text: 'Up with @ridgeline.bsky.social, then Theo', mentions: [theo] }, ofHandle)).toEqual(
      {
        text: 'Up with Sam Ridge, then Theo',
        mentions: [
          { contactId: 'sam', location: 8, name: 'Sam Ridge' },
          { contactId: 'theo', location: 24, name: 'Theo' },
        ],
      },
    );
  });

  it('leaves a handle that means two contacts or none as text, and the value as it was', () => {
    const value = { text: 'With @lee and @nobody', mentions: null };
    expect(linkTypedHandles(value, ofHandle)).toBe(value);
  });

  it('reads a Bluesky handle without its suffix, and a profile link stored as the handle', () => {
    expect(linkTypedHandles({ text: '@ridgeline and @MayaL', mentions: null }, ofHandle)).toEqual({
      text: 'Sam Ridge and Maya Lindqvist',
      mentions: [
        { contactId: 'sam', location: 0, name: 'Sam Ridge' },
        { contactId: 'maya', location: 14, name: 'Maya Lindqvist' },
      ],
    });
  });

  it('leaves a handle inside a URL as text', () => {
    const value = { text: 'See https://bsky.app/@ridgeline', mentions: null };
    expect(linkTypedHandles(value, ofHandle)).toBe(value);
  });
});
