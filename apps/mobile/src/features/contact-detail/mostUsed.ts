import { searchForms } from '@/sync/matchingIds';

/**
 * The distinct non-empty `values`, the most frequent first, values that differ only in case or accents
 * as one ("Sao Paulo" and "São Paulo", as a search compares them): it shows as its most used
 * spelling, the first seen of a tie.
 */
export default function mostUsed(values: string[]): string[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const value of values) {
    if (!value) continue;
    const key = searchForms(value)[0]!;
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count += 1;
    group.spellings.set(value, (group.spellings.get(value) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .map(({ spellings }) => [...spellings].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0]);
}
