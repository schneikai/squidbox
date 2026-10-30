import { uniqueTags } from '@squidbox/shared';

import tagKey from '@/utils/tagKey';

/**
 * The handles the chat shows and sends: those found in the posts (`handles`, useMentions'), without
 * the ones its Mentions sheet took off (`removed`) and with the ones it added (`added`), each once in
 * any case.
 */
export default function chatMentions(handles, { added, removed }) {
  const left = new Set(removed.map(tagKey));
  return uniqueTags([...handles.filter((handle) => !left.has(tagKey(handle))), ...added]);
}
