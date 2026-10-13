// Rows or ids per SQL statement: ~20 columns × 500 stays far below SQLite's 32,766 variables.
export const SQL_BATCH = 500;

/** Split an array into chunks of at most `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
