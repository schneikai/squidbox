import type { Channel } from '@squidbox/shared';

import channelPayload, { payloadText } from './channelPayload';

import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import useCopyText from '@/hooks/useCopyText';
import usePosts from '@/providers/posts/usePosts';
import type { PostCopyWithAssets } from '@/sync/queries/readPostCopies';
import getTimestamp from '@/utils/date-time/getTimestamp';

/**
 * Sending a post's copies, until Squidbox can post for you: `sendNow(copy, channel)` puts the copy's
 * text (its payload, channelPayload) on the clipboard and marks it sent; a failed copy marks nothing
 * and says so. `sendAll(ids)` only marks them sent.
 */
export default function useSendCopies(contactsById: ReadonlyMap<string, MentionContact>) {
  const { setPostCopiesSent } = usePosts();
  const copyText = useCopyText();

  async function sendNow(copy: PostCopyWithAssets, channel: Pick<Channel, 'id' | 'handleField'>) {
    const { payload } = channelPayload(channel, copy.posts, contactsById);
    if (!(await copyText(payloadText(payload), 'The copy is not marked as sent.'))) return;
    await setPostCopiesSent([copy.id], getTimestamp());
  }

  async function sendAll(ids: string[]) {
    await setPostCopiesSent(ids, getTimestamp());
  }

  return { sendNow, sendAll };
}
