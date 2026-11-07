import { describe, expect, it } from 'vitest';

import { splitLocation } from '../src/contacts/splitLocation.js';

describe('splitLocation', () => {
  it('splits city, state and country by the commas', () => {
    expect(splitLocation('Bogotá, D.C., Colombia')).toEqual({ city: 'Bogotá', state: 'D.C.', country: 'Colombia' });
  });

  it('reads a US state, by name or its two letters, as in the United States', () => {
    expect(splitLocation('Denver, CO')).toEqual({ city: 'Denver', state: 'Colorado', country: 'United States' });
    expect(splitLocation('Austin, Texas, USA')).toEqual({ city: 'Austin', state: 'Texas', country: 'United States' });
  });

  it('names the country by its official English name, and reads one part as a country or the city', () => {
    expect(splitLocation('Lisbon, portugal')).toEqual({ city: 'Lisbon', state: '', country: 'Portugal' });
    expect(splitLocation('Colombia')).toEqual({ city: '', state: '', country: 'Colombia' });
    expect(splitLocation('Squamish')).toEqual({ city: 'Squamish', state: '', country: '' });
  });

  it('keeps a last part that is no country as the state', () => {
    expect(splitLocation('Squamish, BC')).toEqual({ city: 'Squamish', state: 'BC', country: '' });
  });
});
