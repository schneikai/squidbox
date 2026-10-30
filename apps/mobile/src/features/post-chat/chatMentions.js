import { CHAT_LIMITS } from '@squidbox/shared';

import withEdits from './withEdits';

/**
 * The handles the chat shows and sends: those found in the posts (`handles`, useMentions'), with the
 * Mentions sheet's edits (`mentionEdits`, withEdits'), each once in any case, within CHAT_LIMITS.
 */
export default function chatMentions(handles, mentionEdits) {
  return withEdits(handles, mentionEdits)
    .filter((handle) => handle.length <= CHAT_LIMITS.mention)
    .slice(0, CHAT_LIMITS.mentions);
}
