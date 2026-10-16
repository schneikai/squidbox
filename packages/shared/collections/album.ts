import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema, timestampSchema } from './define';

// `albums` collection (sync-design §10). Membership lives in the `album_assets` edge collection;
// `postHistory`/`lastPostedAt` are derived on-device from posts + membership (not synced).
// Deletion is a `deletedAt` tombstone.
export const albumCollection = defineCollection({
  name: 'albums',
  schema: baseRecordSchema.extend({
    name: textSchema,
    isFavorite: z.boolean(),
    archivedAt: timestampSchema.nullable(),
    showInPostSuggestionsAfter: timestampSchema.nullable(),
    oldCollectionName: textSchema.nullable(),
    notes: textSchema.nullable(),
    sortOrder: z.enum(['custom']).nullable(),
    smartAlbumType: z.enum(['FAVORITES', 'DELETED']).nullable(),
    // Place in the albums list's custom order: a fractional-index key (fractionalIndex.ts), null for
    // albums never placed. Optional because older app versions don't send it; the server then
    // leaves the stored value alone.
    position: textSchema.nullable().optional(),
  }),
});

export type AlbumRecord = z.infer<typeof albumCollection.schema>;
