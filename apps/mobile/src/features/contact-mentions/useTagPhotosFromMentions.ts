import { Alert } from 'react-native';

import readMentionedContactPhotos from './readMentionedContactPhotos';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useContacts from '@/providers/contacts/useContacts';
import { getDb } from '@/sync/db/client';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';
import pluralizeText from '@/utils/pluralizeText';

/**
 * Tag photos from mentions: puts each contact a post mentions by handle on that post's photos
 * (readMentionedContactPhotos), after saying how many and asking. A contact already on a photo stays
 * as it is, so running it again only adds what is new.
 */
export default function useTagPhotosFromMentions() {
  const { addContactsToPhotos } = useContacts();
  const { showBlocking, hide } = useProgressOverlay();

  async function tagPhotosFromMentionsAsync() {
    try {
      const { photosByContact, postCount } = await readMentionedContactPhotos(getDb());
      if (photosByContact.size === 0) {
        Alert.alert('No mentions match a contact', "No post with photos mentions a contact's handle.");
        return;
      }
      const photoCount = new Set([...photosByContact.values()].flat()).size;
      const contacts = pluralizeText('1 contact', `${photosByContact.size} contacts`, photosByContact.size);
      const posts = pluralizeText('1 post', `${postCount} posts`, postCount);
      const photos = pluralizeText('1 photo', `${photoCount} photos`, photoCount);
      const message = `${posts} ${postCount === 1 ? 'mentions' : 'mention'} ${contacts}. Each goes on the photos of the posts that mention them: ${photos} in all.`;
      if (!(await confirmAsync({ title: 'Tag photos from mentions?', message, action: 'Tag' }))) return;
      showBlocking();
      for (const [contactId, assetIds] of photosByContact) await addContactsToPhotos(assetIds, [contactId]);
      hide();
      Alert.alert('Done!', `Tagged ${photos} with ${contacts}.`);
    } catch (error) {
      hide();
      Alert.alert("Couldn't tag the photos", apiErrorMessage(error));
    }
  }

  return tagPhotosFromMentionsAsync;
}
