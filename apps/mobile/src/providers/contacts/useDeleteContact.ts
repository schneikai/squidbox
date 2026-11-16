import type { ContactRecord } from '@squidbox/shared';

import useContacts from './useContacts';

import { getDb } from '@/sync/db/client';
import readContactUses from '@/sync/queries/readContactUses';
import confirmDeleteAsync from '@/utils/confirmDeleteAsync';
import pluralizeText from '@/utils/pluralizeText';

/**
 * Deleting a contact, as every menu offers it: `deleteContactAsync(contact, { beforeDelete })` asks
 * first (saying how many photos it is tagged on and posts mention it, when any), then runs `beforeDelete` (the contact screen leaves) and deletes the contact.
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
      also: usesText(contact.name, await readContactUses(getDb(), contact.id)),
    });
    if (!confirmed) return;
    beforeDelete?.();
    await setContactDeleted(contact.id);
  };
}

// The confirm's message: what the contact is used on, when anything, then what deleting does.
function usesText(name: string, { photos, posts }: { photos: number; posts: number }): string {
  const leaves = 'They leave your lists and the photos, albums and posts they are on.';
  const uses = [
    photos > 0 && pluralizeText('tagged on %{count} photo', 'tagged on %{count} photos', photos),
    posts > 0 && pluralizeText('mentioned in %{count} post', 'mentioned in %{count} posts', posts),
  ].filter(Boolean);
  if (uses.length === 0) return leaves;
  const mentions = posts > 0 ? ' A mention stays as their name, without a handle.' : '';
  return `${name} is ${uses.join(' and ')}. ${leaves}${mentions}`;
}
