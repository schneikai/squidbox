import { describe, expect, it } from 'vitest';
import { linkTypedHandles } from '../scripts/linkTypedHandles.js';

const sam = { id: 'sam', name: 'Sam Ridge', blueskyHandle: 'ridgeline.bsky.social' };
const maya = { id: 'maya', name: 'Maya Lindqvist', xHandle: 'https://x.com/mayal' };
const twins = [
  { id: 'lee1', name: 'Lee', xHandle: 'lee' },
  { id: 'lee2', name: 'Lee B', instagramHandle: 'lee' },
];
const contacts = [sam, maya, ...twins];

describe('linkTypedHandles', () => {
  it("makes a handle that means one contact that contact's name and mention, the mentions after it moved", () => {
    const theo = { contactId: 'theo', location: 37, name: 'Theo' };
    const { linked } = linkTypedHandles(
      { text: 'Up with @ridgeline.bsky.social, then Theo', mentions: [theo] },
      contacts,
    );
    expect(linked).toEqual({
      text: 'Up with Sam Ridge, then Theo',
      mentions: [
        { contactId: 'sam', location: 8, name: 'Sam Ridge' },
        { contactId: 'theo', location: 24, name: 'Theo' },
      ],
    });
  });

  it('leaves a handle that means two contacts or none as text, and says why', () => {
    expect(linkTypedHandles({ text: 'With @lee and @nobody', mentions: null }, contacts)).toEqual({
      linked: null,
      left: [
        { handle: '@lee', reason: 'several contacts', names: ['Lee', 'Lee B'] },
        { handle: '@nobody', reason: 'no contact' },
      ],
    });
  });

  it('reads a Bluesky handle without its suffix, and a profile link stored as the handle', () => {
    expect(linkTypedHandles({ text: '@ridgeline and @MayaL', mentions: null }, contacts).linked).toEqual({
      text: 'Sam Ridge and Maya Lindqvist',
      mentions: [
        { contactId: 'sam', location: 0, name: 'Sam Ridge' },
        { contactId: 'maya', location: 14, name: 'Maya Lindqvist' },
      ],
    });
  });

  it('leaves a handle inside a URL or an email address alone', () => {
    const value = { text: 'See https://bsky.app/@ridgeline or mail me@ridgeline.bsky.social', mentions: null };
    expect(linkTypedHandles(value, contacts)).toEqual({ linked: null, left: [] });
  });

  it('links nothing twice: a second run changes nothing', () => {
    const once = linkTypedHandles({ text: 'Up with @ridgeline', mentions: null }, contacts).linked!;
    expect(linkTypedHandles(once, contacts).linked).toBeNull();
  });
});
