import { describe, expect, it } from 'vitest';

import citySuggestions from '../src/features/contact-detail/citySuggestions';
import mostUsed from '../src/features/contact-detail/mostUsed';
import shownSuggestions from '../src/features/contact-detail/shownSuggestions';

const CITIES = ['São Paulo', 'São Luís', 'Salvador', 'Düsseldorf', 'Lisbon'].map((text) => ({ text }));
const texts = (suggestions: { text: string }[]) => suggestions.map(({ text }) => text);
const place = (city: string, state: string, country: string) => ({ city, state, country });

describe('shownSuggestions', () => {
  it('offers what contains the typed text, blind to case and accents', () => {
    expect(texts(shownSuggestions(CITIES, 'sao', 5))).toEqual(['São Paulo', 'São Luís']);
    expect(texts(shownSuggestions(CITIES, 'São', 5))).toEqual(['São Paulo', 'São Luís']);
    expect(texts(shownSuggestions(CITIES, 'duesseldorf', 5))).toEqual(['Düsseldorf']);
  });

  it('leaves out the typed text itself but offers its accented spelling', () => {
    expect(shownSuggestions(CITIES, 'são paulo', 5)).toEqual([]);
    expect(texts(shownSuggestions(CITIES, 'Sao Paulo', 5))).toEqual(['São Paulo']);
  });

  it('keeps offering a typed city that names several places, so a tap picks which', () => {
    const bogota = [
      { text: 'Bogotá', detail: 'Colombia' },
      { text: 'Bogotá', detail: 'California, United States' },
    ];
    expect(shownSuggestions(bogota, 'Bogotá', 5)).toEqual(bogota);
  });

  it('offers at most max', () => {
    expect(texts(shownSuggestions(CITIES, 's', 2))).toEqual(['São Paulo', 'São Luís']);
  });
});

describe('citySuggestions', () => {
  it('offers a city in one place, stored with or without its state, once and without a detail', () => {
    const known = [
      place('São Paulo', 'São Paulo', 'Brazil'),
      place('Sao Paulo', '', 'Brazil'),
      place('São Paulo', 'São Paulo', 'Brazil'),
    ];
    expect(citySuggestions(known)).toEqual([{ text: 'São Paulo' }]);
  });

  it('offers a city in several places once per place, told apart by state or country', () => {
    expect(
      citySuggestions([place('Portland', 'Oregon', 'United States'), place('Portland', 'Maine', 'United States')]),
    ).toEqual([
      { text: 'Portland', detail: 'Oregon', place: place('Portland', 'Oregon', 'United States') },
      { text: 'Portland', detail: 'Maine', place: place('Portland', 'Maine', 'United States') },
    ]);
    expect(
      texts(citySuggestions([place('Bogotá', '', 'Colombia'), place('Bogotá', 'California', 'United States')])),
    ).toEqual(['Bogotá', 'Bogotá']);
    expect(
      citySuggestions([place('Bogotá', '', 'Colombia'), place('Bogotá', 'California', 'United States')]).map(
        ({ detail }) => detail,
      ),
    ).toEqual(['Colombia', 'California, United States']);
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
