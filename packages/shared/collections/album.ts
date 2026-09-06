import { z } from 'zod';
import { baseRecordSchema, defineCollection } from './define';

// `albums` collection (sync-design §10). Ordered `assets` is a JSON string array (moves
// atomically under whole-record LWW). Legacy `isDeleted` → modern `deletedAt` tombstone.
export const albumCollection = defineCollection({
  name: 'albums',
  schema: baseRecordSchema.extend({
    name: z.string(),
    assets: z.array(z.string()),
    isFavorite: z.boolean(),
    archivedAt: z.number().nullable(),
    postHistory: z.array(z.string()),
    lastPostedAt: z.number().nullable(),
    showInPostSuggestionsAfter: z.number().nullable(),
    oldCollectionName: z.string().nullable(),
    notes: z.string().nullable(),
    sortOrder: z.enum(['custom']).nullable(),
    smartAlbumType: z.enum(['FAVORITES', 'DELETED']).nullable(),
  }),
});

export type AlbumRecord = z.infer<typeof albumCollection.schema>;
