// A handle after its @: letters, digits and _, with dots or hyphens inside (`name`, `name.bsky.social`).
const HANDLE_BODY = String.raw`\w+(?:[.-]\w+)*`;

// An @handle, not right after a word character or an @, so an email address isn't one. Group 1 is what
// comes before it.
const HANDLE = new RegExp(String.raw`(^|[^\w@])(@${HANDLE_BODY})`, 'g');

/** Each @handle typed in `text` (with its @), in order, with where its @ stands. */
export default function handlesIn(text: string): { handle: string; at: number }[] {
  return [...text.matchAll(HANDLE)].map((match) => ({ handle: match[2]!, at: match.index + match[1]!.length }));
}
