// A handle after its @: letters, digits and _, with dots or hyphens inside (`name`, `name.bsky.social`).
const HANDLE_BODY = String.raw`\w+(?:[.-]\w+)*`;

// An @handle at the start of a word: not right after a letter, a digit or an @ (an email address), nor
// after a character of a URL's path or query (`tiktok.com/@sam`, `?u=@sam`); and not running on into
// a letter a handle can't have (`@josé` is no `@jos`: every network's handle is ASCII). Group 1 is
// what comes before it.
const HANDLE = new RegExp(String.raw`(^|[^\p{L}\p{N}_@/.:=?&#%+~-])(@${HANDLE_BODY})(?![\p{L}\p{N}])`, 'gu');

/** Each @handle typed in `text` (with its @), in order, with where its @ stands. */
export default function handlesIn(text: string): { handle: string; at: number }[] {
  return [...text.matchAll(HANDLE)].map((match) => ({ handle: match[2]!, at: match.index + match[1]!.length }));
}
