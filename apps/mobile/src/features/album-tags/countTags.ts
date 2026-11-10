import { uniqueTags } from '@squidbox/shared';

import tagKey from '@/utils/tagKey';

/**
 * The tags of several photos (`lists`, one per photo; null for a photo never tagged) grouped by
 * tagKey, each with its first spelling and how many photos have it: the ones more photos share
 * first, ties in the order they first appear.
 */
export default function countTags(
  lists: readonly (readonly string[] | null)[],
): { tag: string; key: string; count: number }[] {
  const byKey = new Map<string, { tag: string; key: string; count: number }>();
  for (const list of lists) {
    for (const tag of uniqueTags([...(list ?? [])])) {
      const key = tagKey(tag);
      const entry = byKey.get(key);
      byKey.set(key, { tag: entry?.tag ?? tag, key, count: (entry?.count ?? 0) + 1 });
    }
  }
  // Array.prototype.sort is stable, so equal counts keep their first appearance.
  return [...byKey.values()].sort((a, b) => b.count - a.count);
}
