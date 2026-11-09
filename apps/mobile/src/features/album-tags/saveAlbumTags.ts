import { setTagsOf } from '@/sync/assetsRepository';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { readByIds } from '@/sync/readByIds';
import readPhotoIdsOf from '@/sync/readPhotoIdsOf';
import editedTags from '@/utils/editedTags';
import type { TagsEdit } from '@/utils/tagsDifference';

/**
 * An album's Tags sheet's Save: the edit (editedTags') on the stored tags of each photo the album
 * holds now, in one transaction. Throws when the album was deleted. Doesn't sync.
 */
export default function saveAlbumTags(db: SyncDb, albumId: string, edit: TagsEdit): Promise<void> {
  return db.transaction(async (tx) => {
    const [album] = await readByIds(tx, schema.albums, [albumId]);
    if (!album || album.deletedAt) throw new Error('This album was deleted');
    const ids = await readPhotoIdsOf(tx, { albumId });
    await setTagsOf(tx, ids, (stored) => editedTags(stored, edit));
  });
}
