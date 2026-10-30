import { ASSET_TAG_LIMITS, uniqueTags } from '@squidbox/shared';

import tagKey from '@/utils/tagKey';

/**
 * A photo's `tags` (null while never tagged) after an edit: `remove` taken out (in any case), then
 * `add` added while it has room (ASSET_TAG_LIMITS.tags). Null when the edit leaves it as it was.
 */
export default function editedTags(tags, { add = [], remove = [] }) {
  const removed = new Set(remove.map(tagKey));
  const kept = (tags ?? []).filter((tag) => !removed.has(tagKey(tag)));
  const room = Math.max(ASSET_TAG_LIMITS.tags - kept.length, 0);
  const present = new Set(kept.map(tagKey));
  const added = uniqueTags(add)
    .filter((tag) => !present.has(tagKey(tag)))
    .slice(0, room);
  if (added.length === 0 && kept.length === (tags ?? []).length) return null;
  return [...kept, ...added];
}
