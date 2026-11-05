const LINK = /onlyfans\.com|justfor\.fans/i;
const PARAGRAPH_BREAK = /\n[ \t]*\n\s*/;

/**
 * A post's text split at its first paragraph with an OnlyFans or JustFor.Fans link: the paragraphs
 * before it, and that paragraph with the rest. Null when there is no such link or it is in the first
 * paragraph.
 */
export function splitAtLink(text: string): { first: string; following: string } | null {
  const breaks = [...text.matchAll(new RegExp(PARAGRAPH_BREAK, 'g'))];
  const starts = [0, ...breaks.map((match) => match.index! + match[0].length)];
  const ends = [...breaks.map((match) => match.index!), text.length];
  const at = starts.findIndex((start, i) => LINK.test(text.slice(start, ends[i])));
  if (at <= 0) return null;
  const first = text.slice(0, ends[at - 1]).trim();
  const following = text.slice(starts[at]).trim();
  return first && following ? { first, following } : null;
}

/** Whether the text has an OnlyFans or JustFor.Fans link. */
export function hasLink(text: string): boolean {
  return LINK.test(text);
}
