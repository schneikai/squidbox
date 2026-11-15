import type { MentionContact } from './mentionHandle';

import { isFileName } from '@/library/fileFields';
import useOpenLibrary from '@/library/useOpenLibrary';
import { getAvatarUri } from '@/utils/assets/assetStorage';

/**
 * Where a contact's photo is for a mention chip to draw it (the file on this device); null without
 * one, and the chip shows a grey disc. The chip takes what is on the device, it fetches nothing.
 */
export default function useChipAvatarUri(): (contact: MentionContact | undefined) => string | null {
  const { paths: library } = useOpenLibrary();
  return (contact) => {
    const filename = contact?.avatarFilename;
    return filename && isFileName(filename) ? (getAvatarUri(filename, library) ?? null) : null;
  };
}
