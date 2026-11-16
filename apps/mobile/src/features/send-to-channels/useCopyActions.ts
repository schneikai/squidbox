import { Alert } from 'react-native';

import channelPayload, { payloadText } from './channelPayload';

import readMentionContacts from '@/features/post-mentions/readMentionContacts';
import useCopyText from '@/hooks/useCopyText';
import useHaptics from '@/hooks/useHaptics';
import usePosts from '@/providers/posts/usePosts';
import { getDb } from '@/sync/db/client';
import type { ChannelCopy } from '@/sync/queries/readChannelCopies';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmRemoveAsync from '@/utils/confirmRemoveAsync';
import getTimestamp from '@/utils/date-time/getTimestamp';

/**
 * What Send to channels does with its cards, until Squidbox can post for you: `sendNow(copy)` puts
 * the copy's text (its payload, channelPayload, with the contacts its chips mention read at the tap)
 * on the clipboard and marks it sent, a failed copy marking nothing and saying so; `sendAll(copies)`
 * only marks them sent; `markNotSent(copy)`; `remove(copy)`, after its confirm; `addBack(postId,
 * channelId)` (+). A card that shows the post is stored as it shows. A write that fails says so
 * ("Couldn't …", with the reason and an error haptic), as the composer's Save does.
 */
export default function useCopyActions() {
  const { addPostCopy, removePostCopy, setPostCopiesSent } = usePosts();
  const copyText = useCopyText();
  const haptics = useHaptics();

  async function attempt(write: () => Promise<void>, failure: string) {
    try {
      await write();
    } catch (error) {
      console.error(failure, error);
      haptics.error();
      Alert.alert(failure, apiErrorMessage(error));
    }
  }

  async function sendNow(copy: ChannelCopy) {
    const contactsById = await readMentionContacts(getDb(), copy.posts);
    const { payload } = channelPayload(copy.channel, copy.posts, contactsById);
    if (!(await copyText(payloadText(payload), 'The copy is not marked as sent.'))) return;
    await attempt(() => setPostCopiesSent([copy], getTimestamp()), "Couldn't mark the copy as sent");
  }

  function sendAll(copies: ChannelCopy[]) {
    return attempt(() => setPostCopiesSent(copies, getTimestamp()), "Couldn't mark the copies as sent");
  }

  function markNotSent(copy: ChannelCopy) {
    return attempt(() => setPostCopiesSent([copy], null), "Couldn't mark the copy as not sent");
  }

  async function remove(copy: ChannelCopy) {
    if (await confirmRemoveAsync(`this ${copy.channel.name} copy`))
      await attempt(() => removePostCopy(copy), "Couldn't remove the copy");
  }

  function addBack(postId: string, channelId: string) {
    return attempt(() => addPostCopy(postId, channelId), "Couldn't add the channel");
  }

  return { sendNow, sendAll, markNotSent, remove, addBack };
}
