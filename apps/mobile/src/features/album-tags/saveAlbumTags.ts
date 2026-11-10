import { setTagsOf } from '@/sync/assetsRepository';
import type { SyncDb } from '@/sync/db/types';
import readLiveAlbum from '@/sync/readLiveAlbum';
import readPhotoIdsOf from '@/sync/readPhotoIdsOf';
import editedTags from '@/utils/editedTags';
import type { TagsEdit } from '@/utils/tagsDifference';

/**
 * An album's Tags sheet's Save: the edit (editedTags') on the stored tags of each photo the album
 * holds now, in one transaction: an added tag goes on each photo that has room for it
 * (ASSET_TAG_LIMITS.tags) and skips a full one. Throws when the album was deleted. Doesn't sync.
 */
export default function saveAlbumTags(db: SyncDb, albumId: string, edit: TagsEdit): Promise<void> {
  return db.transaction(async (tx) => {
    if (!(await readLiveAlbum(tx, albumId))) throw new Error('This album was deleted');
    const ids = await readPhotoIdsOf(tx, { albumId });
    await setTagsOf(tx, ids, (stored) => editedTags(stored, edit));
  });
}
