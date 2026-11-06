/**
 * The ids of the rows whose text contains `searchText` (lowercased): Unicode-aware, literal and
 * case-insensitive, which SQLite's LIKE and lower() aren't (they fold ASCII only and read % and _ as
 * wildcards). So a search matches in JS and SQL takes the ids (see inJson).
 */
export function matchingIds(rows: { id: string; text: string }[], searchText: string): string[] {
  return rows.filter((row) => row.text.toLowerCase().includes(searchText)).map((row) => row.id);
}
