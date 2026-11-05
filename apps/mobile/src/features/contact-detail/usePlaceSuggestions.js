import { CONTACT_PLACE_PARTS, placeParts } from '@squidbox/shared';
import { useMemo } from 'react';

import useContactRows from '@/features/contact-list/useContactRows';

/**
 * What a place's parts can be filled with: for each of city, state and country, the values the
 * user's contacts already have, the most used first (each once, ignoring case). Empty while reading.
 */
export default function usePlaceSuggestions() {
  const contacts = useContactRows({ scope: 'all' });

  return useMemo(() => {
    const places = (contacts ?? []).flatMap((contact) => contact.places.map(placeParts));
    return Object.fromEntries(CONTACT_PLACE_PARTS.map((part) => [part, mostUsed(places.map((place) => place[part]))]));
  }, [contacts]);
}

// The distinct non-empty values, the most frequent first; the first spelling seen stands for its case.
function mostUsed(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    const key = value.toLowerCase();
    const entry = counts.get(key) ?? { value, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).map(({ value }) => value);
}
