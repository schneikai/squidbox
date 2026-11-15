import { parseHandle, type ContactHandleField } from '@squidbox/shared';

import type { ContactSummary } from '@/sync/queries/contactQuery';

/** What the mention rules read of a contact (of what a chip shows, ContactSummary): its name, avatar and handles. */
export type MentionContact = Pick<ContactSummary, 'id' | 'name'> &
  Partial<Pick<ContactSummary, 'avatarFilename' | 'isFavorite' | ContactHandleField>>;

/**
 * A contact's handle in `field`, bare (no @), as a mention writes it: the handle typed, or a stored
 * profile link's handle (parseHandle); null without one, or for a link that is no profile of that
 * network.
 */
export default function mentionHandle(contact: MentionContact, field: ContactHandleField): string | null {
  return parseHandle(contact[field] ?? '', field).handle;
}
