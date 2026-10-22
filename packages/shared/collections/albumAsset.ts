import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

// `album_assets` — a junction collection: one record per (album, asset) membership. Promoted out
// of the old `album.assets` array so add / remove / reorder each touch a single edge row and
// compose across devices under the per-field LWW (no membership loss). `position` is a
// fractional-index key (see fractionalIndex.ts) giving the asset's order within the album; a
// reorder rewrites only the moved edge's key. Removal is a tombstone (`deletedAt`), never a hard
// delete. Edge id is deterministic — uuidv5(`${albumId}:${assetId}`) — so two devices adding the
// same asset converge on one row.
export const albumAssetCollection = defineCollection({
  name: 'album_assets',
  schema: baseRecordSchema.extend({
    albumId: z.string().uuid(),
    assetId: z.string().uuid(),
    position: textSchema,
  }),
});

export type AlbumAssetRecord = z.infer<typeof albumAssetCollection.schema>;
