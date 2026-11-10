import { CONTACT_PLACE_PARTS, type ContactPlace, placeParts } from '@squidbox/shared';
import { useMemo } from 'react';

import mostUsed from './mostUsed';

import useContactRows from '@/features/contact-list/useContactRows';

/**
 * What a place's parts can be filled with: `suggestions`, for each of city, state and country, the
 * values the user's contacts already have, the most used first (each once, ignoring case and accents); and
 * `knownPlaces`, their places (autofillPlace's). Empty while reading.
 */
export type PlaceSuggestions = { suggestions: Record<keyof ContactPlace, string[]>; knownPlaces: ContactPlace[] };

export default function usePlaceSuggestions(): PlaceSuggestions {
  const contacts = useContactRows({ scope: 'all' });

  return useMemo(() => {
    const knownPlaces = (contacts ?? []).flatMap((contact) => contact.places.map(placeParts));
    const suggestions = Object.fromEntries(
      CONTACT_PLACE_PARTS.map((part) => [part, mostUsed(knownPlaces.map((place) => place[part]))]),
    ) as PlaceSuggestions['suggestions'];
    return { suggestions, knownPlaces };
  }, [contacts]);
}
