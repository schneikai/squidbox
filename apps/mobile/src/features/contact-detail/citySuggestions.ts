import { type ContactPlace, formatPlace } from '@squidbox/shared';

import distinctPlaces from './distinctPlaces';
import mostUsed from './mostUsed';
import samePlaceText from './samePlaceText';

import { searchForms } from '@/sync/matchingIds';

/** A city to offer: its name, and, when the name is known in more than one place, which place. */
export type CitySuggestion = { text: string; detail?: string; place?: ContactPlace };

/**
 * The cities the `known` places (the user's contacts') name, the most used first, each once by its
 * most used spelling (blind to case and accents). A city known in one place is its name alone; one
 * known in several different places (distinctPlaces: "São Paulo, Brazil" beside "São Paulo, São Paulo,
 * Brazil" is one) is offered once per place, with what tells them apart as its `detail`: the state
 * where they share a country ("Portland" · "Oregon", "Maine"), else the country, with its state in the
 * United States ("Bogotá" · "Colombia", "California, United States").
 */
export default function citySuggestions(known: readonly ContactPlace[]): CitySuggestion[] {
  const byCity = new Map<string, ContactPlace[]>();
  for (const place of known) {
    if (!place.city.trim()) continue;
    const key = searchForms(place.city.trim())[0]!;
    byCity.set(key, [...(byCity.get(key) ?? []), place]);
  }
  return [...byCity.values()]
    .sort((a, b) => b.length - a.length)
    .flatMap((group) => {
      const [text = ''] = mostUsed(group.map((place) => place.city.trim()));
      const places = distinctPlaces(group, ['state', 'country']);
      if (places.length <= 1) return [{ text }];
      const sharesCountry = places.every((place) => samePlaceText(place.country, places[0]!.country));
      return places.map((place) => ({
        text,
        detail: sharesCountry ? place.state.trim() || '–' : formatPlace({ ...place, city: '' }) || '–',
        place,
      }));
    });
}
