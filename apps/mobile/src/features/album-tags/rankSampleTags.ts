import { uniqueTags } from '@squidbox/shared';

import tagKey from '@/utils/tagKey';

/**
 * The tags of a few sample photos (`lists`, one per photo) as one list for an album: the ones more
 * photos share first, ties in the order they first appear, each once in any case (the first
 * spelling), at most `max`.
 */
export default function rankSampleTags(lists: readonly (readonly string[])[], max: number): string[] {
  const byKey = new Map<string, { tag: string; count: number }>();
  for (const list of lists) {
    for (const tag of uniqueTags([...list])) {
      const key = tagKey(tag);
      const entry = byKey.get(key);
      byKey.set(key, { tag: entry?.tag ?? tag, count: (entry?.count ?? 0) + 1 });
    }
  }
  // Array.prototype.sort is stable, so equal counts keep their first appearance.
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
    .map((entry) => entry.tag);
}
