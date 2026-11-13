/** Words as a sentence lists them: "X", "X and Y", "X, Y and Z" (`conjunction` in place of "and"). */
export default function joinWords(words: readonly string[], conjunction: 'and' | 'or' = 'and'): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} ${conjunction} ${words.at(-1)}`;
}
