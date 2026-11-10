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

  it('completes a place it read from the places the contacts know', () => {
    const known = [{ city: 'São Paulo', state: 'São Paulo', country: 'Brazil' }];
    expect(filledFrom(read({ city: 'São Paulo', country: 'Brazil' }), draft(), known).places).toEqual([
      { city: 'São Paulo', state: 'São Paulo', country: 'Brazil' },
    ]);
  });

  it('leaves the notes to the user, whatever the bio and website say', () => {
    expect(
      filledFrom(read({ bio: 'Trail runs <3', website: 'https://onlyfans.com/mayal' }), draft()).notes,
    ).toBeUndefined();
  });
});
