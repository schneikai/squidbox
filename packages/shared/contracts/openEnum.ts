import { z } from 'zod';

/**
 * A wire enum an old build reads and may meet a value it doesn't know (docs/sync-design.md §15): its
 * known values, or any other string, which the reader handles as its else case. Adding a value is
 * then no break for the contract check. Only for a value the app reads and never sends.
 */
export function openEnum<const T extends [string, ...string[]]>(values: T): z.ZodType<T[number] | (string & {})> {
  // The union's own inference collapses to `string`, which loses the known values for autocomplete
  // and exhaustive lookups; the cast keeps them.
  return z.enum(values).or(z.string()) as unknown as z.ZodType<T[number] | (string & {})>;
}
