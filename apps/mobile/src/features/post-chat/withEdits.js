import { uniqueTags } from '@squidbox/shared';

import tagKey from '@/utils/tagKey';

/**
 * `list` without the `removed` items and with the `added` ones after it, each once, compared without
 * case: a chat's tags or handles with what its sheets changed.
 */
export default function withEdits(list, { added = [], removed = [] }) {
  const left = new Set(removed.map(tagKey));
  return uniqueTags([...list.filter((item) => !left.has(tagKey(item))), ...added]);
}
