/**
 * The ids, each once, of the rows whose text contains `searchText` (an id may have a row per text it
 * is searched by): Unicode-aware, literal, and blind to case, accents and the usual spellings of
 * letters like ü and ß ("sao" finds "São", "muller" and "mueller" find "Müller", "strasse" finds
 * "Straße", and back), which SQLite's LIKE and lower() aren't (they fold ASCII only and read % and _
 * as wildcards). So a search matches in JS and SQL takes the ids (see inJson).
 */
export function matchingIds(rows: { id: string; text: string }[], searchText: string): string[] {
  const needles = searchForms(searchText);
  const matched = rows.filter((row) => {
    const forms = searchForms(row.text);
    return needles.some((needle) => forms.some((form) => form.includes(needle)));
  });
  return [...new Set(matched.map((row) => row.id))];
}

// Letters Unicode doesn't decompose into a base letter and a mark, by how they're written without them.
const SPELLED: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };
const GERMAN_UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue' };

/**
 * The forms a text is compared in: its base letters (canonical decomposition, NFD, with the
 * combining marks U+0300–U+036F dropped, so "Müller" is "muller"), and, when it has an umlaut, the
 * German spelling too ("mueller"). A search matches when any form of it is in any form of the text,
 * so each of "Müller", "Muller" and "Mueller" finds the others.
 */
export function searchForms(text: string): string[] {
  const lower = text.normalize('NFC').toLowerCase();
  const base = foldMarks(lower);
  if (!/[äöü]/.test(lower)) return [base];
  return [base, foldMarks(lower.replace(/[äöü]/g, (letter) => GERMAN_UMLAUTS[letter]))];
}

function foldMarks(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ßæœøłđðþı]/g, (letter) => SPELLED[letter]);
}
