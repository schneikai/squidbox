import handlesIn from './handlesIn';

/**
 * The distinct @handles in `texts` (handlesIn), those used most first (then the first seen), compared
 * without case; each keeps the spelling it was first seen with.
 */
export default function extractHandles(texts: readonly string[]): string[] {
  const byKey = new Map<string, { handle: string; count: number; order: number }>();
  for (const text of texts) {
    for (const { handle } of handlesIn(text)) {
      const key = handle.toLowerCase();
      const seen = byKey.get(key);
      if (seen) seen.count += 1;
      else byKey.set(key, { handle, count: 1, order: byKey.size });
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.order - b.order).map(({ handle }) => handle);
}
