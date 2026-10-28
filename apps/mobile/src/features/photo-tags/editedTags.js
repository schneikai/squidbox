import { ASSET_TAG_LIMITS, uniqueTags } from '@squidbox/shared';

/**
 * A photo's `tags` (null while never tagged) after an edit of the tags of several photos at once:
 * `remove` taken out (in any case), then `add` added while it has room (ASSET_TAG_LIMITS.tags), so a
 * photo already full skips them. Null when the edit leaves it as it was.
 */
export default function editedTags(tags, { add = [], remove = [] }) {
  const removed = new Set(remove.map(keyOf));
  const kept = (tags ?? []).filter((tag) => !removed.has(keyOf(tag)));
  const room = Math.max(ASSET_TAG_LIMITS.tags - kept.length, 0);
  const present = new Set(kept.map(keyOf));
  const added = uniqueTags(add)
    .filter((tag) => !present.has(keyOf(tag)))
    .slice(0, room);
  if (added.length === 0 && kept.length === (tags ?? []).length) return null;
  return [...kept, ...added];
}

function keyOf(tag) {
  return tag.trim().toLowerCase();
}
