import { type ContactPlace, placeParts } from '@squidbox/shared';
import { useMemo } from 'react';

import citySuggestions, { type CitySuggestion } from './citySuggestions';
import mostUsed from './mostUsed';

import useContactRows from '@/features/contact-list/useContactRows';

/**
 * What a place's parts can be filled with: `cities`, the cities the user's contacts have
 * (citySuggestions: one per place where a name is known in several); `suggestions`, for state and
 * country, the values they have, the most used first (each once, ignoring case and accents); and
 * `knownPlaces`, their places (autofillPlace's). Empty while reading.
 */
export type PlaceSuggestions = {
  cities: CitySuggestion[];
  suggestions: Record<'state' | 'country', string[]>;
  knownPlaces: ContactPlace[];
};

export default function usePlaceSuggestions(): PlaceSuggestions {
  const contacts = useContactRows({ scope: 'all' });

  return useMemo(() => {
    const knownPlaces = (contacts ?? []).flatMap((contact) => contact.places.map(placeParts));
    const suggestions = {
      state: mostUsed(knownPlaces.map((place) => place.state)),
      country: mostUsed(knownPlaces.map((place) => place.country)),
    };
    return { cities: citySuggestions(knownPlaces), suggestions, knownPlaces };
  }, [contacts]);
}
