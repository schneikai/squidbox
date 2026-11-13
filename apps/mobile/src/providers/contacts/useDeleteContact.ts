import type { ContactRecord } from '@squidbox/shared';

import useContacts from './useContacts';

import confirmDeleteAsync from '@/utils/confirmDeleteAsync';

/**
 * Deleting a contact, as every menu offers it: `deleteContactAsync(contact, { beforeDelete })` asks
 * first, then runs `beforeDelete` (the contact screen leaves) and deletes the contact.
 */
type DeleteOptions = { beforeDelete?: () => void };

export default function useDeleteContact(): (
  contact: Pick<ContactRecord, 'id' | 'name'>,
  options?: DeleteOptions,
) => Promise<void> {
  const { setContactDeleted } = useContacts();

  return async function deleteContactAsync(contact, { beforeDelete }: DeleteOptions = {}) {
    const confirmed = await confirmDeleteAsync({
      name: contact.name,
      also: 'They leave your lists and the photos, albums and posts they are on.',
    });
    if (!confirmed) return;
    beforeDelete?.();
    await setContactDeleted(contact.id);
  };
}
