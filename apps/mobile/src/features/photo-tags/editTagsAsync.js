import editedTags from './editedTags';

import { setTags } from '@/sync/assetsRepository';
import { getDb } from '@/sync/db/client';
import { requestSync } from '@/sync/worker';

/**
 * Edits the tags of the assets with these ids (`{ add, remove }`, editedTags'): one setTags each,
 * made on the stored tags inside its write, so an edit never undoes another stored meanwhile; a photo
 * the edit leaves as it was isn't written. Then syncs.
 */
export default async function editTagsAsync(ids, edit) {
  const db = getDb();
  await Promise.all(ids.map((id) => setTags(db, id, (stored) => editedTags(stored, edit))));
  requestSync();
}
