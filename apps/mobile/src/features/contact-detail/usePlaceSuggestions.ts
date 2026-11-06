import { CONTACT_PLACE_PARTS, type ContactPlace, placeParts } from '@squidbox/shared';
import { useMemo } from 'react';

import useContactRows from '@/features/contact-list/useContactRows';

/**
 * What a place's parts can be filled with: `suggestions`, for each of city, state and country, the
 * values the user's contacts already have, the most used first (each once, ignoring case); and
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

// The distinct non-empty values, the most frequent first; the first spelling seen stands for its case.
function mostUsed(values: string[]): string[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const value of values) {
    if (!value) continue;
    const key = value.toLowerCase();
    const entry = counts.get(key) ?? { value, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).map(({ value }) => value);
}
