import { describe, it, expect } from 'vitest';

import { makeContactRecord } from './helpers/factory';
import { contactDraft, storedContactFields } from '../src/features/contact-detail/contactFields';

describe('contact form fields', () => {
  it('stores each handle as typed, only trimmed, and an empty one as null', () => {
    const stored = storedContactFields({
      ...contactDraft(),
      xHandle: ' @MayaL ',
      blueskyHandle: 'https://x.com/MayaL',
      onlyFansHandle: 'TodoesMorb0',
      jffHandle: '  ',
    });
    expect(stored).toMatchObject({
      xHandle: '@MayaL',
      blueskyHandle: 'https://x.com/MayaL',
      onlyFansHandle: 'TodoesMorb0',
      jffHandle: null,
      instagramHandle: null,
    });
  });

  it('opening a contact rewrites none of its handles', () => {
    for (const xHandle of ['mayal', '@MayaL']) {
      const contact = makeContactRecord({ xHandle });
      expect(contactDraft(contact).xHandle).toBe(xHandle);
      expect(storedContactFields(contactDraft(contact)).xHandle).toBe(xHandle);
    }
  });
});
