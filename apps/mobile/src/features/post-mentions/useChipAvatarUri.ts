import { useCallback } from 'react';

import type { MentionContact } from './mentionHandle';

import avatarOnDevice from '@/features/contact-avatar/avatarOnDevice';
import useOpenLibrary from '@/library/useOpenLibrary';

/**
 * Where a contact's photo is for the mention field to draw it in a chip (avatarOnDevice, the file on
 * this device); null without one, and the chip shows a grey disc. The field takes what is on the
 * device, it fetches nothing. The function stays the same while the library does.
 */
export default function useChipAvatarUri(): (contact: MentionContact | undefined) => string | null {
  const { paths: library } = useOpenLibrary();
  return useCallback((contact) => avatarOnDevice(contact?.avatarFilename, library), [library]);
}
