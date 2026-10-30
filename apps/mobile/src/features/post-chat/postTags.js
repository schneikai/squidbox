import { uniqueTags } from '@squidbox/shared';

import tagKey from '@/utils/tagKey';

/**
 * The tags the chat shows and sends for its post: its photos' (`rows`, the live assets) together,
 * without the ones the card took off (`removedTags`) and with the ones it added (`addedTags`), each
 * once in any case. So a photo added later, or tagged later, still brings its tags.
 */
export default function postTags(rows, { addedTags, removedTags }) {
  const removed = new Set(removedTags.map(tagKey));
  const fromPhotos = rows.flatMap((row) => row.tags ?? []).filter((tag) => !removed.has(tagKey(tag)));
  return uniqueTags([...fromPhotos, ...addedTags]);
}
