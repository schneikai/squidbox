// A handle after its @: letters, digits and _, with dots or hyphens inside (`name`, `name.bsky.social`).
const HANDLE_BODY = String.raw`\w+(?:[.-]\w+)*`;

// An @handle: not right after a letter, a digit, an _ or an @ (an email address), and not running on
// into a letter a handle can't have (`@josé` is no `@jos`: every network's handle is ASCII). Group 1
// is the run of characters before it, up to a space.
const HANDLE = new RegExp(String.raw`(\S*?)(?<![\p{L}\p{N}_@])(@${HANDLE_BODY})(?![\p{L}\p{N}])`, 'gu');

// A run before an @ that makes it part of a URL: a scheme (`https://`) or a domain followed by a path
// or a query (`tiktok.com/`, `x.com?u=`).
const IN_URL = /:\/\/|[\p{L}\p{N}-]\.[a-z]{2,}[/?]/iu;

/**
 * The @handles typed in `text` (with their @), each once without case, in their first spelling. An @
 * inside a URL (`https://tiktok.com/@sam`) or an email address is none; one after other punctuation
 * is (`w/@sam`, `📸:@maya`, `ft.@sam`).
 */
export default function typedHandles(text: string): string[] {
  const byKey = new Map<string, string>();
  for (const match of text.matchAll(HANDLE)) {
    const handle = match[2]!;
    if (IN_URL.test(match[1]!) || byKey.has(handle.toLowerCase())) continue;
    byKey.set(handle.toLowerCase(), handle);
  }
  return [...byKey.values()];
}
