import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const FAVORITE_LIMITS = { text: 2000 } as const;

// `favorites` — the posts the assistant writes like (Settings → Assistant → Favorites): an option
// hearted in the chat, or one of your own posts added by hand. Newest `createdAt` first.
// `source` (where it came from) was dropped in server 0029 / app 0028; a push from an older build
// that still sends it has it stripped by the schema like any unknown field. Removing one is a tombstone, and Undo restores it (`deletedAt` back to null).
export const favoriteCollection = defineCollection({
  name: 'favorites',
  schema: baseRecordSchema.extend({
    text: textSchema.min(1).max(FAVORITE_LIMITS.text),
  }),
});

export type FavoriteRecord = z.infer<typeof favoriteCollection.schema>;
