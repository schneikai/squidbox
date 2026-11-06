import { describe, expect, it } from 'vitest';

import { placesChanged } from '../src/features/contact-detail/contactFields';

const place = (city: string, state = '', country = '') => ({ city, state, country });
const squamish = place('Squamish', 'British Columbia', 'Canada');
const lisbon = place('Lisbon', '', 'Portugal');
const denver = place('Denver', 'Colorado', 'United States');

describe('placesChanged', () => {
  it('edits the place the sheet opened with where it is now, after a place was added before it', () => {
    expect(placesChanged([denver, squamish, lisbon], squamish, place('Whistler'))).toEqual([
      denver,
      place('Whistler'),
      lisbon,
    ]);
  });

  it('removes the place the sheet opened with, not the one now at its old index', () => {
    expect(placesChanged([denver, squamish, lisbon], squamish, null)).toEqual([denver, lisbon]);
  });

  it('adds an edited place that was removed meanwhile at the end', () => {
    expect(placesChanged([lisbon], squamish, place('Whistler'))).toEqual([lisbon, place('Whistler')]);
  });

  it('leaves the places as they are when the removed place is gone already', () => {
    expect(placesChanged([lisbon, denver], squamish, null)).toEqual([lisbon, denver]);
  });

  it('finds a place stored as text by its value', () => {
    expect(placesChanged(['Squamish, British Columbia, Canada', lisbon], squamish, null)).toEqual([lisbon]);
  });
});
