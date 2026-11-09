import { setTags } from '@/sync/assetsRepository';
import { getDb } from '@/sync/db/client';
import { requestSync } from '@/sync/worker';
import editedTags from '@/utils/editedTags';
import type { TagsEdit } from '@/utils/tagsDifference';

/**
 * Edits the tags of the asset with this id (`{ add, remove }`, editedTags'), made on its stored tags
 * inside the write (setTags), so an edit never undoes another stored meanwhile; an edit that leaves
 * them as they were writes nothing. Then syncs.
 */
export default async function editTagsAsync(id: string, edit: TagsEdit): Promise<void> {
  await setTags(getDb(), id, (stored) => editedTags(stored, edit));
  requestSync();
}
