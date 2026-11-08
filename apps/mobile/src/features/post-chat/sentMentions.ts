import chatMentions from './chatMentions';
import type { Mentions } from './useMentions';
import type { ListEdits } from './withEdits';

/**
 * The handles the chat shows and sends: those found in the posts (`found`, useMentions'; none while
 * reading) with the Mentions sheet's edits (chatMentions).
 */
export default function sentMentions(found: Mentions | undefined, mentionEdits: ListEdits): string[] {
  return found ? chatMentions(found.handles, mentionEdits) : [];
}
