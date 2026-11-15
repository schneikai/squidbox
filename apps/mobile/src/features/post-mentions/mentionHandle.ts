import { parseHandle, type ContactHandleField, type ContactRecord } from '@squidbox/shared';

/** What the mention rules read of a contact: its name, avatar and handles. */
export type MentionContact = Pick<ContactRecord, 'id' | 'name'> &
  Partial<Pick<ContactRecord, 'avatarFilename' | 'isFavorite'>> &
  Partial<Record<ContactHandleField, string | null>>;

/**
 * A contact's handle in `field`, bare (no @), as a mention writes it: the handle typed, or a stored
 * profile link's handle (parseHandle); null without one, or for a link that is no profile of that
 * network.
 */
export default function mentionHandle(contact: MentionContact, field: ContactHandleField): string | null {
  return parseHandle(contact[field] ?? '', field).handle;
}
