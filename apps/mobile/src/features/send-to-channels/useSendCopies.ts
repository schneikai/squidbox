import type { Channel } from '@squidbox/shared';

import channelPayload, { payloadText } from './channelPayload';

import readMentionContacts from '@/features/post-mentions/readMentionContacts';
import useCopyText from '@/hooks/useCopyText';
import usePosts from '@/providers/posts/usePosts';
import { getDb } from '@/sync/db/client';
import type { ChannelCopy } from '@/sync/queries/readChannelCopies';
import getTimestamp from '@/utils/date-time/getTimestamp';

/**
 * Sending a post's copies, until Squidbox can post for you: `sendNow(copy, channel)` puts the copy's
 * text (its payload, channelPayload, with the contacts its chips mention read at the tap) on the clipboard and marks it sent; a failed copy marks nothing
 * and says so. `sendAll(copies)` only marks them sent. An untouched card is stored as it shows, sent.
 */
export default function useSendCopies() {
  const { setPostCopiesSent } = usePosts();
  const copyText = useCopyText();

  async function sendNow(copy: ChannelCopy, channel: Pick<Channel, 'id' | 'handleField'>) {
    const contactsById = await readMentionContacts(getDb(), copy.posts);
    const { payload } = channelPayload(channel, copy.posts, contactsById);
    if (!(await copyText(payloadText(payload), 'The copy is not marked as sent.'))) return;
    await setPostCopiesSent([copy], getTimestamp());
  }

  async function sendAll(copies: ChannelCopy[]) {
    await setPostCopiesSent(copies, getTimestamp());
  }

  return { sendNow, sendAll };
}
