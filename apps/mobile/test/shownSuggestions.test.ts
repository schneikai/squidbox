import { describe, expect, it } from 'vitest';

import mostUsed from '../src/features/contact-detail/mostUsed';
import shownSuggestions from '../src/features/contact-detail/shownSuggestions';

const CITIES = ['São Paulo', 'São Luís', 'Salvador', 'Düsseldorf', 'Lisbon'];

describe('shownSuggestions', () => {
  it('offers what contains the typed text, blind to case and accents', () => {
    expect(shownSuggestions(CITIES, 'sao', 5)).toEqual(['São Paulo', 'São Luís']);
    expect(shownSuggestions(CITIES, 'São', 5)).toEqual(['São Paulo', 'São Luís']);
    expect(shownSuggestions(CITIES, 'duesseldorf', 5)).toEqual(['Düsseldorf']);
  });

  it('leaves out the typed text itself but offers its accented spelling', () => {
    expect(shownSuggestions(CITIES, 'são paulo', 5)).toEqual([]);
    expect(shownSuggestions(CITIES, 'Sao Paulo', 5)).toEqual(['São Paulo']);
  });

  it('offers at most max', () => {
    expect(shownSuggestions(CITIES, 's', 2)).toEqual(['São Paulo', 'São Luís']);
  });
});

describe('mostUsed', () => {
  it('counts spellings that differ in case or accents as one value, shown as its most used spelling', () => {
    expect(mostUsed(['Lisbon', 'Sao Paulo', 'São Paulo', 'são paulo', 'São Paulo', '', 'Lisbon'])).toEqual([
      'São Paulo',
      'Lisbon',
    ]);
  });
});
