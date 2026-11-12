import { type ContactRead, emptyContactRead } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import { contactDraft } from '../src/features/contact-detail/contactFields';
import filledFrom from '../src/features/contact-new/filledFrom';

const read = (fields: Partial<ContactRead> & { bio?: string; website?: string }) => ({
  ...emptyContactRead(),
  ...fields,
});
const draft = (fields: Parameters<typeof contactDraft>[0] = {}) => contactDraft(fields);

describe('filledFrom', () => {
  it('does not fill a handle the draft already holds, as typed with @ and capitals', () => {
    const typed = { ...draft(), xHandle: '@mayal' };
    expect(filledFrom(read({ xHandle: 'MayaL', onlyFansHandle: 'mayal' }), typed)).toEqual({
      onlyFansHandle: 'mayal',
    });
  });

  it('does not fill a name the draft already has', () => {
    expect(filledFrom(read({ name: 'Maya Lindqvist' }), draft({ name: 'Maya Lindqvist ' }))).toEqual({});
  });

  it('shows the handles as their fields write them', () => {
    expect(filledFrom(read({ blueskyHandle: 'Maya.bsky.social', jffHandle: 'mayal' }), draft())).toEqual({
      blueskyHandle: '@Maya.bsky.social',
      jffHandle: 'mayal',
    });
  });

  it('writes a single @ and a link as it is', () => {
    expect(filledFrom(read({ xHandle: '@@MayaL', instagramHandle: 'https://x.com/i/lists/1' }), draft())).toEqual({
      xHandle: '@MayaL',
      instagramHandle: 'https://x.com/i/lists/1',
    });
  });

  it('a read of only @s fills nothing', () => {
    expect(filledFrom(read({ xHandle: '@' }), { ...draft(), xHandle: '@MayaL' })).toEqual({});
  });

  it('cuts a long handle after writing its @', () => {
    const xHandle = filledFrom(read({ xHandle: 'm'.repeat(200) }), draft()).xHandle;
    expect(xHandle).toHaveLength(200);
    expect(xHandle?.startsWith('@')).toBe(true);
  });

  it('puts a place it read first, unless the draft has it', () => {
    const lisbon = { city: 'Lisbon', state: '', country: 'Portugal' };
    const squamish = { city: 'Squamish', state: 'BC', country: 'Canada' };
    expect(filledFrom(read(squamish), draft({ places: [lisbon] })).places).toEqual([squamish, lisbon]);
    expect(filledFrom(read(squamish), draft({ places: [squamish] })).places).toBeUndefined();
  });

  describe('a place it read', () => {
    const known = [
      { city: 'São Paulo', state: 'São Paulo', country: 'Brazil' },
      { city: 'San José', state: '', country: 'Costa Rica' },
      { city: 'Portland', state: 'Oregon', country: 'United States' },
      { city: 'Portland', state: 'Maine', country: 'United States' },
    ];
    const placesOf = (fields: Partial<ContactRead>, typed = draft()) => filledFrom(read(fields), typed, known).places;

    it('takes the spelling the contacts use and is completed from their places', () => {
      expect(placesOf({ city: 'sao paulo', country: 'Brazil' })).toEqual([
        { city: 'São Paulo', state: 'São Paulo', country: 'Brazil' },
      ]);
    });

    it('is not added again when the draft has it in its completed form', () => {
      const typed = draft({ places: [{ city: 'São Paulo', state: 'São Paulo', country: 'Brazil' }] });
      expect(placesOf({ city: 'Sao Paulo', country: 'Brazil' }, typed)).toBeUndefined();
    });

    it('stays as read for a city the contacts never had', () => {
      expect(placesOf({ city: 'Curitiba', country: 'Brazil' })).toEqual([
        { city: 'Curitiba', state: '', country: 'Brazil' },
      ]);
    });

    it('takes no spelling or state from a city of the same name in another country', () => {
      expect(placesOf({ city: 'San Jose', state: 'California', country: 'United States' })).toEqual([
        { city: 'San Jose', state: 'California', country: 'United States' },
      ]);
    });

    it('gets no state when the contacts know the city in two states', () => {
      expect(placesOf({ city: 'Portland', country: 'United States' })).toEqual([
        { city: 'Portland', state: '', country: 'United States' },
      ]);
    });
  });

  it('leaves the notes to the user, whatever the bio and website say', () => {
    expect(
      filledFrom(read({ bio: 'Trail runs <3', website: 'https://onlyfans.com/mayal' }), draft()).notes,
    ).toBeUndefined();
  });
});
