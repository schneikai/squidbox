// An @handle: letters, digits and _, with dots or hyphens inside (`@name`, `@name.bsky.social`), not
// right after a word character, so an email address isn't one. Group 1 is what comes before it.
const HANDLE = /(^|[^\w@])(@\w+(?:[.-]\w+)*)/g;

/**
 * The distinct @handles in `texts`, those used most first (then the first seen), compared without
 * case; each keeps the spelling it was first seen with.
 */
export default function extractHandles(texts) {
  const byKey = new Map();
  for (const text of texts) {
    for (const [, , handle] of text.matchAll(HANDLE)) {
      const key = handle.toLowerCase();
      const seen = byKey.get(key);
      if (seen) seen.count += 1;
      else byKey.set(key, { handle, count: 1, order: byKey.size });
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.order - b.order).map(({ handle }) => handle);
}
