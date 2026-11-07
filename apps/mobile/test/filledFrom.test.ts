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
    const typed = { ...draft(), xHandle: '@MayaL' };
    expect(filledFrom(read({ xHandle: 'mayal', onlyFansHandle: 'mayal' }), typed)).toEqual({
      onlyFansHandle: 'mayal',
    });
  });

  it('does not fill a name the draft already has', () => {
    expect(filledFrom(read({ name: 'Maya Lindqvist' }), draft({ name: 'Maya Lindqvist ' }))).toEqual({});
  });

  it('shows the handles as their fields write them', () => {
    expect(filledFrom(read({ blueskyHandle: 'maya.bsky.social', jffHandle: 'mayal' }), draft())).toEqual({
      blueskyHandle: '@maya.bsky.social',
      jffHandle: 'mayal',
    });
  });

  it('puts a place it read first, unless the draft has it', () => {
    const lisbon = { city: 'Lisbon', state: '', country: 'Portugal' };
    const squamish = { city: 'Squamish', state: 'BC', country: 'Canada' };
    expect(filledFrom(read(squamish), draft({ places: [lisbon] })).places).toEqual([squamish, lisbon]);
    expect(filledFrom(read(squamish), draft({ places: [squamish] })).places).toBeUndefined();
  });

  it('leaves the notes to the user, whatever the bio and website say', () => {
    expect(
      filledFrom(read({ bio: 'Trail runs <3', website: 'https://onlyfans.com/mayal' }), draft()).notes,
    ).toBeUndefined();
  });
});
