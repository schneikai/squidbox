import { formatPlace, placeParts } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

describe('formatPlace', () => {
  it('says a place as City, Country, without the state outside the US', () => {
    expect(formatPlace({ city: 'Squamish', state: 'British Columbia', country: 'Canada' })).toBe('Squamish, Canada');
  });

  it('keeps the state in the US', () => {
    expect(formatPlace({ city: 'Denver', state: 'Colorado', country: 'United States' })).toBe(
      'Denver, Colorado, United States',
    );
  });

  it('says the parts it has when the city is missing', () => {
    expect(formatPlace({ city: '', state: 'Tyrol', country: 'Austria' })).toBe('Tyrol, Austria');
  });
});

describe('placeParts', () => {
  it('reads a missing part as empty, so a place without a country still shows', () => {
    expect(placeParts({ city: 'Squamish' })).toEqual({ city: 'Squamish', state: '', country: '' });
    expect(formatPlace({ city: 'Squamish' })).toBe('Squamish');
  });

  it('reads a place stored as one string as its city', () => {
    expect(formatPlace('Squamish, Canada')).toBe('Squamish, Canada');
  });
});
