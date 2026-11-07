import {
  type ContactFromXProfileResponse,
  emptyContactRead,
  imageDataUrl,
  OTHER_HANDLE_FIELDS,
} from '@squidbox/shared';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import filledFrom from './filledFrom';
import useClipboardXLink from './useClipboardXLink';
import useNewContactDraft from './useNewContactDraft';

import type { ContactDraft } from '@/features/contact-detail/contactFields';
import useHasFeature from '@/hooks/useHasFeature';
import readXProfileWithAssistantAsync from '@/utils/cloud-api/ai/readXProfileWithAssistantAsync';
import readXProfileAsync from '@/utils/cloud-api/contacts/readXProfileAsync';

// Whether the assistant may find more in a found profile: handles still missing, with a bio or
// website to find them in (the server splits the place itself).
function hasMoreToRead(read: ContactFromXProfileResponse): boolean {
  return OTHER_HANDLE_FIELDS.some((field) => !read[field]) && !!(read.bio || read.website);
}

// Whether the profile's bio or website names `handle`: the assistant's handles count only then, so
// one it made up (the X handle in every field, say) fills nothing.
function isNamedIn(handle: string, read: ContactFromXProfileResponse): boolean {
  return !!handle && `${read.bio}\n${read.website}`.toLowerCase().includes(handle.toLowerCase());
}

/**
 * New contact's From link: the X profile link on the clipboard fills the X handle at once, then what
 * the server reads from the public profile (the name, photo, place and handles; never the notes), all
 * as one fill with Undo; with the `ai` feature the assistant's pass then adds, in the background, the
 * handles still missing that the bio or website names, into the same fill, marked as the assistant's. A profile
 * X hides alerts so and offers `onScreenshot` (From screenshot, with `ai`), a missing one alerts so,
 * and a read that fails fills the handle only. Without a name from the profile, the contact is named
 * after the handle, only while the draft has no name when the read lands. The web build takes no
 * photo (it can't make a contact photo; the photo picker's web twin says so).
 */
export default function useFillFromLink(onScreenshot: () => void): {
  isReading: boolean;
  fillFromLinkAsync: () => Promise<void>;
} {
  const { fillFields, extendFill } = useNewContactDraft();
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
      // Only the handles the profile's links didn't give and its bio or website names; the place is the server's.
      const handles = Object.fromEntries(
        OTHER_HANDLE_FIELDS.map((field) => [field, !read[field] && isNamedIn(found[field], read) ? found[field] : '']),
      );
      extendFill(id, 'assistant', (draft) => filledFrom({ ...emptyContactRead(), ...handles }, draft), {
        onlyIntoEmpty: true,
      });
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
    const id = fillFields('link', (draft) => filledFrom({ ...emptyContactRead(), xHandle: handle }, draft));
    // The handle as the name, while the draft has none when this lands.
    const nameAfterHandle = (draft: ContactDraft): Partial<ContactDraft> => (draft.name.trim() ? {} : { name: handle });
    setIsReading(true);
    let read: ContactFromXProfileResponse | null = null;
    try {
      read = await readXProfileAsync(handle);
    } catch (error) {
      console.warn('From link: the X profile could not be read', error);
    } finally {
      setIsReading(false);
    }
    if (read?.status === 'found') {
      const found = read;
      const photoUri = found.avatar && Platform.OS !== 'web' ? imageDataUrl(found.avatar) : undefined;
      extendFill(
        id,
        'link',
        (draft) => ({ ...filledFrom(found, draft), ...(found.name ? {} : nameAfterHandle(draft)) }),
        { photoUri },
      );
      // In the background, the card free again: its answer extends the fill when it lands (it never throws).
      if (canUseAssistant && hasMoreToRead(found)) readWithAssistantAsync(id, found);
      return;
    }
    extendFill(id, 'link', nameAfterHandle);
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
  }

  return { isReading, fillFromLinkAsync };
}
