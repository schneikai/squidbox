import { searchForms } from '@/sync/matchingIds';

/**
 * The `suggestions` to offer for what is `typed`, at most `max`: those that contain it the way a
 * search does (searchForms: blind to case and accents, so "sao" offers "São Paulo"), except the typed
 * text itself. A spelling that differs only in its accents is still offered ("Sao Paulo" offers
 * "São Paulo"), so a tap can correct it.
 */
export default function shownSuggestions(suggestions: readonly string[], typed: string, max: number): string[] {
  const text = typed.trim();
  const needles = searchForms(text);
  return suggestions
    .filter((suggestion) => {
      if (suggestion.toLowerCase() === text.toLowerCase()) return false;
      const forms = searchForms(suggestion);
      return needles.some((needle) => forms.some((form) => form.includes(needle)));
    })
    .slice(0, max);
}
