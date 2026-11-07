import { type ContactFromLinkResponse, emptyContactRead, imageDataUrl } from '@squidbox/shared';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import filledFrom from './filledFrom';
import useClipboardXLink from './useClipboardXLink';
import useNewContactDraft from './useNewContactDraft';

import type { ContactDraft } from '@/features/contact-detail/contactFields';
import readContactFromLinkAsync from '@/utils/cloud-api/ai/readContactFromLinkAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * New contact's From link, an assistant feature (the `ai` one): the X profile link on the clipboard,
 * read by the server and the user's writing model (the name, handles and place, never the notes) as
 * From screenshot reads a picture, fills it all at once with its photo, as one fill with Undo; the
 * card shows its spinner till then. A profile X hides alerts so and offers `onScreenshot` (From
 * screenshot), a missing one alerts so, and a read that fails says why; each fills the link's handle
 * only. Without a name, the contact is named after the handle, only while the draft has none. The web
 * build takes no photo (it can't make a contact photo; the photo picker's web twin says so).
 */
export default function useFillFromLink(onScreenshot: () => void): {
  isReading: boolean;
  fillFromLinkAsync: () => Promise<void>;
} {
  const { fillFields } = useNewContactDraft();
  const { readAsync } = useClipboardXLink();
  const [isReading, setIsReading] = useState(false);

  async function fillFromLinkAsync() {
    let pasted: Awaited<ReturnType<typeof readAsync>> = null;
    try {
      pasted = await readAsync();
    } catch (error) {
      console.warn('Could not read the clipboard', error);
    }
    if (!pasted) {
      Alert.alert('No X link on the clipboard', 'Copy the link of a profile on X, then tap From link.');
      return;
    }
    const { handle } = pasted;
    setIsReading(true);
    let read: ContactFromLinkResponse | null = null;
    let readError: unknown = null;
    try {
      read = await readContactFromLinkAsync(handle);
    } catch (error) {
      readError = error;
    } finally {
      setIsReading(false);
    }
    const contact = read?.contact ?? { ...emptyContactRead(), xHandle: handle };
    const photoUri = read?.avatar && Platform.OS !== 'web' ? imageDataUrl(read.avatar) : undefined;
    // The handle as the name, while the draft has none.
    fillFields(
      'link',
      (draft: ContactDraft) => ({
        ...filledFrom(contact, draft),
        ...(contact.name || draft.name.trim() ? {} : { name: handle }),
      }),
      photoUri,
    );
    if (readError) Alert.alert("Couldn't read the profile", apiErrorMessage(readError));
    else if (read?.status === 'notFound')
      Alert.alert(
        `No profile @${handle} on X`,
        "The link points at a profile that doesn't exist. The handle is filled in anyway.",
      );
    else if (read?.status === 'unavailable')
      Alert.alert(
        'X hides this profile',
        'X shows this profile only to signed-in readers, so there is nothing more to fill.',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'From screenshot', onPress: onScreenshot },
        ],
      );
    // `failed`: the server logged why; the handle is what From link always fills.
  }

  return { isReading, fillFromLinkAsync };
}
