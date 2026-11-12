import { searchForms } from '@/sync/matchingIds';

/**
 * Whether two parts of a place (a city, state or country) name the same, the way a search compares
 * them: blind to case, accents and surrounding spaces ("Sao Paulo" is "São Paulo").
 */
export default function samePlaceText(a: string, b: string): boolean {
  return searchForms(a.trim())[0] === searchForms(b.trim())[0];
}
