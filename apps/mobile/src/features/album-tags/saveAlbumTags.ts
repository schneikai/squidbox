import { setTagsOf } from '@/sync/assetsRepository';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { readPhotoIdsOf } from '@/sync/photoContacts';
import { readByIds } from '@/sync/readByIds';
import editedTags from '@/utils/editedTags';
import type { TagsEdit } from '@/utils/tagsDifference';

/**
 * An album's Tags sheet's Save: the edit (`{ add, remove }`, editedTags') made on each photo the
 * album holds now, on its stored tags, in one transaction, so a tag stored meanwhile stays and a tag
 * on only some photos that wasn't touched stays on exactly those. Throws when the album was deleted.
 * It doesn't sync (the sheet does).
 */
export default function saveAlbumTags(db: SyncDb, albumId: string, edit: TagsEdit): Promise<void> {
  return db.transaction(async (tx) => {
    const [album] = await readByIds(tx, schema.albums, [albumId]);
    if (!album || album.deletedAt) throw new Error('This album was deleted');
    const ids = await readPhotoIdsOf(tx, { albumId });
    await setTagsOf(tx, ids, (stored) => editedTags(stored, edit));
  });
}
