import {
  type ContactFromXProfileResponse,
  type ContactRead,
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
import readXProfileWithAssistantAsync from '@/utils/cloud-api/ai/readXProfileWithAssistantAsync';
import readXProfileAsync from '@/utils/cloud-api/contacts/readXProfileAsync';

// Whether the assistant has anything to read in a found profile: a place, a bio or a website.
function hasTextToRead(read: ContactFromXProfileResponse): boolean {
  return !!(read.location || read.bio || read.website);
}

// Whether the profile's bio or website names `handle`: the assistant's handles count only then, so
// one it made up (the X handle in every field, say) fills nothing.
function isNamedIn(handle: string, read: ContactFromXProfileResponse): boolean {
  return !!handle && `${read.bio}\n${read.website}`.toLowerCase().includes(handle.toLowerCase());
}

/**
 * New contact's From link, an assistant feature (the `ai` one): reads the X profile the link on the
 * clipboard points at, the assistant reading the handles and the place from its text (never the
 * notes), as From screenshot reads a picture, and fills it all at once, once everything is in, as one
 * fill with Undo: the X handle, the name and photo the public profile shows, and the assistant's
 * fields, marked as its. The card shows its spinner till then. A profile X hides alerts so and offers
 * `onScreenshot` (From screenshot), a missing one alerts so, and a read that fails fills the handle
 * only (an assistant's read that fails, the profile's fields only). Without a name from the profile,
 * the contact is named after the handle, only while the draft has no name. The web build takes no
 * photo (it can't make a contact photo; the photo picker's web twin says so).
 */
export default function useFillFromLink(onScreenshot: () => void): {
  isReading: boolean;
  fillFromLinkAsync: () => Promise<void>;
} {
  const { fillFields, extendFill } = useNewContactDraft();
  const { readAsync } = useClipboardXLink();
  const [isReading, setIsReading] = useState(false);

  // The handles and the place the assistant reads in the profile, or null when it can't.
  async function readWithAssistantAsync(read: ContactFromXProfileResponse): Promise<Partial<ContactRead> | null> {
    try {
      const found = await readXProfileWithAssistantAsync({
        handle: read.xHandle,
        name: read.name,
        bio: read.bio,
        location: read.location,
        website: read.website,
      });
      // A handle only when the bio or website names it, so one it made up fills nothing.
      const handles = Object.fromEntries(
        OTHER_HANDLE_FIELDS.map((field) => [field, isNamedIn(found[field], read) ? found[field] : '']),
      );
      return { ...handles, city: found.city, state: found.state, country: found.country };
    } catch (error) {
      // The profile's fields stand.
      console.warn('From link: the assistant could not read the X profile', error);
      return null;
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
    // The handle as the name, while the draft has none.
    const nameAfterHandle = (draft: ContactDraft): Partial<ContactDraft> => (draft.name.trim() ? {} : { name: handle });
    setIsReading(true);
    let read: ContactFromXProfileResponse | null = null;
    let assistantRead: Partial<ContactRead> | null = null;
    try {
      read = await readXProfileAsync(handle);
      if (read.status === 'found' && hasTextToRead(read)) assistantRead = await readWithAssistantAsync(read);
    } catch (error) {
      console.warn('From link: the X profile could not be read', error);
    } finally {
      setIsReading(false);
    }
    if (read?.status === 'found') {
      const found = read;
      const shown = { ...emptyContactRead(), xHandle: found.xHandle, name: found.name };
      const photoUri = found.avatar && Platform.OS !== 'web' ? imageDataUrl(found.avatar) : undefined;
      const id = fillFields(
        'link',
        (draft) => ({ ...filledFrom(shown, draft), ...(found.name ? {} : nameAfterHandle(draft)) }),
        photoUri,
      );
      if (assistantRead) {
        const fields = assistantRead;
        extendFill(id, 'assistant', (draft) => filledFrom({ ...emptyContactRead(), ...fields }, draft), {
          onlyIntoEmpty: true,
        });
      }
      return;
    }
    fillFields('link', (draft) => ({
      ...filledFrom({ ...emptyContactRead(), xHandle: handle }, draft),
      ...nameAfterHandle(draft),
    }));
    if (read?.status === 'notFound')
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
    // `failed` or no answer: the server logged why; the handle is what From link always fills.
  }

  return { isReading, fillFromLinkAsync };
}
