import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

// `albums` collection (sync-design §10). Membership lives in the `album_assets` edge collection;
// `postHistory`/`lastPostedAt` are derived on-device from posts + membership (not synced).
// Deletion is a `deletedAt` tombstone.
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
    // Place in the albums list's custom order: a fractional-index key (fractionalIndex.ts), null for
    // albums never placed. Optional because older app versions don't send it; the server then
    // leaves the stored value alone.
    position: z.string().nullable().optional(),
  }),
});

export type AlbumRecord = z.infer<typeof albumCollection.schema>;
