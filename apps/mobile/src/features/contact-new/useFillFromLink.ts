import {
  type ContactFromXProfileResponse,
  emptyContactRead,
  imageDataUrl,
  OTHER_HANDLE_FIELDS,
} from '@squidbox/shared';
import { useState } from 'react';
import { Alert } from 'react-native';

import filledFrom from './filledFrom';
import useClipboardXLink from './useClipboardXLink';
import useNewContactDraft from './useNewContactDraft';

import { handleText } from '@/features/contact-detail/contactFields';
import useHasFeature from '@/hooks/useHasFeature';
import readXProfileWithAssistantAsync from '@/utils/cloud-api/ai/readXProfileWithAssistantAsync';
import readXProfileAsync from '@/utils/cloud-api/contacts/readXProfileAsync';

// Whether the assistant may find more in a found profile: a location to split, or handles still
// missing with a bio or website to find them in.
function hasMoreToRead(read: ContactFromXProfileResponse): boolean {
  const isMissingHandles = OTHER_HANDLE_FIELDS.some((field) => !read[field]);
  return !!read.city || (isMissingHandles && !!(read.bio || read.website));
}

/**
 * New contact's From link: the X profile link on the clipboard fills the X handle at once, then what
 * the server reads from the public profile (the name, photo, place, notes and handles), as one fill
 * with Undo; with the `ai` feature the assistant's pass then adds the handles still missing and the
 * place split, into the same fill. A profile X hides alerts so and offers `onScreenshot` (From
 * screenshot, with `ai`), a missing one alerts so, and a read that fails fills the handle only. Where
 * nothing more is filled, the name is the handle, unless the draft has one by then.
 */
export default function useFillFromLink(onScreenshot: () => void): {
  isReading: boolean;
  fillFromLinkAsync: () => Promise<void>;
} {
  const { setField, setFieldIfEmpty, fillFields, extendFill } = useNewContactDraft();
  const { readAsync } = useClipboardXLink();
  const canUseAssistant = useHasFeature('ai');
  const [isReading, setIsReading] = useState(false);

  async function readWithAssistantAsync(id: number, read: ContactFromXProfileResponse) {
    try {
      const found = await readXProfileWithAssistantAsync({
        handle: read.xHandle,
        name: read.name,
        bio: read.bio,
        location: read.city,
        website: read.website,
      });
      // Only the handles the profile's links didn't give.
      const handles = Object.fromEntries(OTHER_HANDLE_FIELDS.map((field) => [field, read[field] ? '' : found[field]]));
      extendFill(id, (draft) => filledFrom({ ...emptyContactRead(), ...found, ...handles }, draft));
    } catch (error) {
      // The profile's own fields stand.
      console.warn('From link: the assistant could not read the X profile', error);
    }
  }

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
    setField('xHandle', handleText('xHandle', handle));
    setIsReading(true);
    try {
      const read = await readXProfileAsync(handle).catch((error: unknown) => {
        console.warn('From link: the X profile could not be read', error);
        return null;
      });
      if (read?.status === 'found') {
        const photoUri = read.avatar ? imageDataUrl(read.avatar) : undefined;
        const id = fillFields('link', (draft) => filledFrom({ ...read, name: read.name || handle }, draft), photoUri);
        if (canUseAssistant && hasMoreToRead(read)) await readWithAssistantAsync(id, read);
        return;
      }
      setFieldIfEmpty('name', handle);
      if (read?.status === 'notFound')
        Alert.alert(
          `No profile @${handle} on X`,
          "The link points at a profile that doesn't exist. The handle is filled in anyway.",
        );
      else if (read?.status === 'unavailable')
        Alert.alert(
          'X hides this profile',
          'X shows this profile only to signed-in readers, so there is nothing more to fill.',
          canUseAssistant
            ? [
                { text: 'OK', style: 'cancel' },
                { text: 'From screenshot', onPress: onScreenshot },
              ]
            : undefined,
        );
      // `failed` or no answer: the server logged why; the handle is what From link always fills.
    } finally {
      setIsReading(false);
    }
  }

  return { isReading, fillFromLinkAsync };
}
