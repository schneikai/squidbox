import { describe, expect, it } from 'vitest';

import contactPlaces from '../src/features/contact-list/contactPlaces';

describe('contactPlaces', () => {
  it('says every place of the contact, not only the first', () => {
    const places = [
      { city: '', state: 'Maine', country: 'United States' },
      { city: 'Berlin', state: '', country: 'Germany' },
    ];
    expect(contactPlaces({ places })).toBe('Maine, United States · Berlin, Germany');
  });

  it('is null for a contact without places', () => {
    expect(contactPlaces({ places: [] })).toBeNull();
  });
});
