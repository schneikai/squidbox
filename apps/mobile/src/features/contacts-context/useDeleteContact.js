import useContacts from './useContacts';

import confirmAsync from '@/utils/confirmAsync';

/**
 * Deleting a contact, as every menu offers it: `deleteContactAsync(contact, { beforeDelete })` asks
 * first, then runs `beforeDelete` (the contact screen leaves) and deletes the contact.
 */
export default function useDeleteContact() {
  const { setContactDeleted } = useContacts();

  return async function deleteContactAsync(contact, { beforeDelete } = {}) {
    const confirmed = await confirmAsync({
      title: `Delete ${contact.name}?`,
      message: 'They leave your lists and the photos, albums and posts they are on.',
      action: 'Delete contact',
      destructive: true,
    });
    if (!confirmed) return;
    beforeDelete?.();
    await setContactDeleted(contact.id);
  };
}
