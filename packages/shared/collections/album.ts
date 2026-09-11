import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

// `albums` collection (sync-design §10). Membership moved to the `album_assets` junction
// collection; `postHistory`/`lastPostedAt` are derived on-device from posts + membership (not
// synced). Legacy `isDeleted` → modern `deletedAt` tombstone.
export const albumCollection = defineCollection({
  name: 'albums',
  schema: baseRecordSchema.extend({
    name: z.string(),
    isFavorite: z.boolean(),
    archivedAt: z.number().nullable(),
    showInPostSuggestionsAfter: z.number().nullable(),
    oldCollectionName: z.string().nullable(),
    notes: z.string().nullable(),
    sortOrder: z.enum(['custom']).nullable(),
    smartAlbumType: z.enum(['FAVORITES', 'DELETED']).nullable(),
  }),
});

export type AlbumRecord = z.infer<typeof albumCollection.schema>;
