import { describe, expect, it } from 'vitest';

import autofillPlace from '../src/features/contact-detail/autofillPlace';

const KNOWN = [
  { city: 'Squamish', state: 'British Columbia', country: 'Canada' },
  { city: 'Portland', state: 'Oregon', country: 'United States' },
  { city: 'Portland', state: 'Maine', country: 'United States' },
  { city: 'Lisbon', state: '', country: 'Portugal' },
  'Denver, Colorado, United States',
];
const place = (city: string, state = '', country = '') => ({ city, state, country });

describe('autofillPlace', () => {
  it('a city that names one known place fills its empty state and country', () => {
    expect(autofillPlace(place('squamish'), 'city', KNOWN)).toEqual(place('squamish', 'British Columbia', 'Canada'));
    expect(autofillPlace(place('Denver'), 'city', KNOWN)).toEqual(place('Denver', 'Colorado', 'United States'));
  });

  it('a state in one known country fills an empty country', () => {
    expect(autofillPlace(place('', 'Oregon'), 'state', KNOWN)).toEqual(place('', 'Oregon', 'United States'));
  });

  it('fills only from the specific to the general: a country fills nothing, a state no city', () => {
    expect(autofillPlace(place('', '', 'Portugal'), 'country', KNOWN)).toEqual(place('', '', 'Portugal'));
    expect(autofillPlace(place('', 'British Columbia'), 'state', KNOWN)).toEqual(
      place('', 'British Columbia', 'Canada'),
    );
  });

  it('a city known in two places fills nothing', () => {
    expect(autofillPlace(place('Portland'), 'city', KNOWN)).toEqual(place('Portland'));
  });

  it('keeps the parts the user already filled', () => {
    expect(autofillPlace(place('Squamish', 'BC'), 'city', KNOWN)).toEqual(place('Squamish', 'BC', 'Canada'));
  });
});
