import { z } from 'zod';
import { baseRecordSchema, defineCollection, textSchema } from './define';

export const FAVORITE_LIMITS = { text: 2000, source: 60 } as const;

// `favorites` — the posts the assistant writes like (Settings → Assistant → Favorites): an option
// hearted in the chat, or one of your own posts added by hand or picked by "Fill it in for me".
// `source` is the prompt button's name for a chat heart, null for your own post. Newest
// `createdAt` first. Removing one is a tombstone, and Undo restores it (`deletedAt` back to null).
export const favoriteCollection = defineCollection({
  name: 'favorites',
  schema: baseRecordSchema.extend({
    text: textSchema.min(1).max(FAVORITE_LIMITS.text),
    source: textSchema.max(FAVORITE_LIMITS.source).nullable(),
  }),
});

export type FavoriteRecord = z.infer<typeof favoriteCollection.schema>;
