import { uniqueTags } from '@squidbox/shared';

import tagKey from '@/utils/tagKey';

// What a chat's sheets changed in its tags or handles, kept over the chat (one change is a TagsEdit,
// `{ add, remove }`).
export type ListEdits = { added: string[]; removed: string[] };

/**
 * `list` without the `removed` items and with the `added` ones after it, each once, compared without
 * case: a chat's tags or handles with what its sheets changed.
 */
export default function withEdits(list: readonly string[], { added = [], removed = [] }: Partial<ListEdits>): string[] {
  const left = new Set(removed.map(tagKey));
  return uniqueTags([...list.filter((item) => !left.has(tagKey(item))), ...added]);
}
