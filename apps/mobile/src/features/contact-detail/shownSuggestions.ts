import { searchForms } from '@/sync/matchingIds';

/** A value a field offers: its `text`, and a `detail` that tells it apart from another of the same text. */
export type Suggestion = { text: string; detail?: string };

/**
 * The `suggestions` to offer for what is `typed`, at most `max`: those that contain it the way a
 * search does (searchForms: blind to case and accents, so "sao" offers "São Paulo"), except the typed
 * text itself, unless it has a `detail` (a city known in several places stays offered once typed, so
 * a tap picks which). A spelling that differs only in its accents is still offered ("Sao Paulo"
 * offers "São Paulo"), so a tap can correct it.
 */
export default function shownSuggestions<T extends Suggestion>(
  suggestions: readonly T[],
  typed: string,
  max: number,
): T[] {
  const text = typed.trim();
  const needles = searchForms(text);
  return suggestions
    .filter((suggestion) => {
      if (!suggestion.detail && suggestion.text.toLowerCase() === text.toLowerCase()) return false;
      const forms = searchForms(suggestion.text);
      return needles.some((needle) => forms.some((form) => form.includes(needle)));
    })
    .slice(0, max);
}
