import { CHAT_LIMITS } from '@squidbox/shared';

import withEdits, { type ListEdits } from './withEdits';

/**
 * The handles the chat shows and sends: those the Mentions sheet added (`added`) first, so the limit
 * never cuts them, then those found in the posts (`handles`, useMentions') without the ones it took
 * off (`removed`), each once in any case, within CHAT_LIMITS.
 */
export default function chatMentions(handles: readonly string[], { added, removed }: ListEdits): string[] {
  return withEdits([...added, ...handles], { removed })
    .filter((handle) => handle.length <= CHAT_LIMITS.mention)
    .slice(0, CHAT_LIMITS.mentions);
}
